using System.Collections.Generic;
using System.IO;
using System.Linq;

using Dxs.Bsv.Protocol;
using Dxs.Bsv.Script.Build;

namespace Dxs.Bsv.Script.Read;

public class LockingScriptReader : BaseScriptReader
{
    private class DetectContext
    {
        public bool Result { get; set; } = true;
        public bool OpReturnReached { get; set; }
    }

    private enum DstasStage
    {
        Owner,
        Second,
        Base,
        Redemption,
        Flags,
        Tail
    }

    private class DstasDetectContext
    {
        public bool Result { get; set; } = true;
        public DstasStage Stage { get; set; } = DstasStage.Owner;
        public int BaseIdx { get; set; }
        public bool FreezeEnabled { get; set; }
        public bool ConfiscationEnabled { get; set; }
        public int ExpectedServiceFieldsCount { get; set; }
        public byte[] Owner { get; set; }
        public byte[] ActionDataRaw { get; set; }
        public byte? ActionDataOpCode { get; set; }
        public byte[] Redemption { get; set; }
        public byte[] Flags { get; set; }
        public List<byte[]> ServiceFields { get; } = new();
        public List<byte[]> OptionalData { get; } = new();
    }

    private readonly Dictionary<ScriptType, DetectContext> _typeDetector =
        new()
        {
            { ScriptType.P2PKH, new DetectContext() },
            { ScriptType.P2MPKH, new DetectContext() },
            { ScriptType.P2STAS, new DetectContext() },
            { ScriptType.Mnee1Sat, new DetectContext() },
            { ScriptType.NullData, new DetectContext() },
        };

    private readonly DstasDetectContext _dstasCtx = new();

    private LockingScriptReader(
        BitcoinStreamReader bitcoinStreamReader,
        int length,
        Network network
    ) : base(bitcoinStreamReader, length, network) { }

    public ScriptType ScriptType
    {
        get
        {
            if (_scriptTypeOverride is { } over)
                return over;

            foreach (var (type, value) in _typeDetector)
            {
                if (value.Result)
                    return type;
            }

            return ScriptType.Unknown;
        }
    }

    private ScriptType? _scriptTypeOverride;

    public Address Address { get; private set; }

    public List<byte[]> Data { get; private set; } //TODO [Oleg] use slices

    /// <summary>
    /// Parsed DSTAS fields (populated only when ScriptType == DSTAS).
    /// </summary>
    public DstasInfo Dstas { get; private set; }

    private void Read()
    {
        var count = ReadInternal();

        if (ReadBytes != ExpectedLength)
            BitcoinStreamReader.ReadNBytes((ulong)(ExpectedLength - ReadBytes));

        if (count == -1) return;

        foreach (var (type, value) in _typeDetector)
        {
            if (!value.Result) continue;

            var sample = ScriptSamples.ByType[type];
            _typeDetector[type].Result = _typeDetector[type].OpReturnReached || sample.Count == count;
        }

        FinalizeDstas();
    }

    protected override bool HandleToken(ScriptReadToken token, int tokenIdx, bool isLastToken)
    {
        var goOn = false;

        foreach (var (type, value) in _typeDetector)
        {
            if (!value.Result) continue;

            var sample = ScriptSamples.ByType[type];

            if (!value.OpReturnReached)
            {
                if (sample.Count == tokenIdx)
                {
                    if (token.OpCode == OpCode.OP_RETURN)
                    {
                        value.OpReturnReached = true;
                        goOn = true;
                    }
                }
                else
                {
                    var newValue = sample.Count > tokenIdx && sample[tokenIdx].Same(token);

                    _typeDetector[type].Result = newValue;

                    if (newValue)
                    {
                        if (sample[tokenIdx].IsReceiverId)
                        {
                            Address = new Address(token.Bytes, ScriptType, Network);
                        }

                        // if (sample[tokenIdx].IsData)
                        // {
                        //     AddData(token.Bytes.ToArray());
                        // }
                    }

                    goOn |= newValue;
                }
            }
            else
            {
                AddData(token.Bytes.ToArray());

                goOn = true;
            }
        }

        HandleDstasToken(token);
        if (_dstasCtx.Result) goOn = true;

        return goOn;
    }

    private static bool IsPushData(ScriptReadToken token)
    {
        var op = token.OpCodeNum;
        return op > 0 &&
               (op < (byte)OpCode.OP_PUSHDATA1 ||
                op == (byte)OpCode.OP_PUSHDATA1 ||
                op == (byte)OpCode.OP_PUSHDATA2 ||
                op == (byte)OpCode.OP_PUSHDATA4);
    }

    private void HandleDstasToken(ScriptReadToken token)
    {
        if (!_dstasCtx.Result) return;

        switch (_dstasCtx.Stage)
        {
            case DstasStage.Owner:
            {
                if (!IsPushData(token) || !IdentityField.IsSupportedIdentityField(token.Bytes.ToArray()))
                {
                    _dstasCtx.Result = false;
                    return;
                }

                _dstasCtx.Owner = token.Bytes.ToArray();
                _dstasCtx.Stage = DstasStage.Second;
                return;
            }

            case DstasStage.Second:
            {
                if (IsPushData(token))
                    _dstasCtx.ActionDataRaw = token.Bytes.ToArray();
                else
                    _dstasCtx.ActionDataOpCode = token.OpCodeNum;

                _dstasCtx.Stage = DstasStage.Base;
                return;
            }

            case DstasStage.Base:
            {
                var baseTokens = ScriptSamples.DstasBaseTokens;
                if (_dstasCtx.BaseIdx >= baseTokens.Count ||
                    !baseTokens[_dstasCtx.BaseIdx].Same(token))
                {
                    _dstasCtx.Result = false;
                    return;
                }

                _dstasCtx.BaseIdx++;
                if (_dstasCtx.BaseIdx == baseTokens.Count)
                    _dstasCtx.Stage = DstasStage.Redemption;

                return;
            }

            case DstasStage.Redemption:
            {
                if (!IsPushData(token) || token.Bytes.Length != 20)
                {
                    _dstasCtx.Result = false;
                    return;
                }

                _dstasCtx.Redemption = token.Bytes.ToArray();
                _dstasCtx.Stage = DstasStage.Flags;
                return;
            }

            case DstasStage.Flags:
            {
                if (!IsPushData(token))
                {
                    _dstasCtx.Result = false;
                    return;
                }

                _dstasCtx.Flags = token.Bytes.ToArray();
                var rightmostByte = _dstasCtx.Flags.Length > 0
                    ? _dstasCtx.Flags[_dstasCtx.Flags.Length - 1]
                    : (byte)0;
                _dstasCtx.FreezeEnabled = (rightmostByte & 0x01) == 0x01;
                _dstasCtx.ConfiscationEnabled = (rightmostByte & 0x02) == 0x02;
                _dstasCtx.ExpectedServiceFieldsCount =
                    (_dstasCtx.FreezeEnabled ? 1 : 0) +
                    (_dstasCtx.ConfiscationEnabled ? 1 : 0);
                _dstasCtx.Stage = DstasStage.Tail;
                return;
            }

            case DstasStage.Tail:
            {
                if (!IsPushData(token))
                {
                    _dstasCtx.Result = false;
                    return;
                }

                var data = token.Bytes.ToArray();
                if (_dstasCtx.ServiceFields.Count < _dstasCtx.ExpectedServiceFieldsCount)
                {
                    if (!IdentityField.IsSupportedIdentityField(data))
                    {
                        _dstasCtx.Result = false;
                        return;
                    }

                    _dstasCtx.ServiceFields.Add(data);
                }
                else
                {
                    _dstasCtx.OptionalData.Add(data);
                }

                return;
            }
        }
    }

    private void FinalizeDstas()
    {
        if (!_dstasCtx.Result) return;
        if (_dstasCtx.Stage is DstasStage.Owner or DstasStage.Second or DstasStage.Base
            or DstasStage.Redemption or DstasStage.Flags)
            return;
        if (_dstasCtx.Owner == null || _dstasCtx.Redemption == null || _dstasCtx.Flags == null)
            return;
        if (_dstasCtx.ServiceFields.Count < _dstasCtx.ExpectedServiceFieldsCount)
            return;

        _scriptTypeOverride = ScriptType.DSTAS;

        if (_dstasCtx.Owner.Length == 20)
            Address = new Address(_dstasCtx.Owner, ScriptType.DSTAS, Network);

        Dstas = new DstasInfo
        {
            Owner = _dstasCtx.Owner,
            ActionDataRaw = _dstasCtx.ActionDataRaw,
            ActionDataOpCode = _dstasCtx.ActionDataOpCode,
            Redemption = _dstasCtx.Redemption,
            Flags = _dstasCtx.Flags,
            FreezeEnabled = _dstasCtx.FreezeEnabled,
            ConfiscationEnabled = _dstasCtx.ConfiscationEnabled,
            ServiceFields = _dstasCtx.ServiceFields,
            OptionalData = _dstasCtx.OptionalData,
        };
    }

    public static LockingScriptReader Read(string hex, Network network)
    {
        var bytes = hex.FromHexString();

        return Read(bytes, network);
    }

    public static LockingScriptReader Read(byte[] bytes, Network network)
    {
        using var stream = new MemoryStream(bytes);

        return Read(stream, network);
    }

    public static LockingScriptReader Read(Stream stream, Network network)
    {
        using var bitcoinStreamReader = new BitcoinStreamReader(stream);

        return Read(bitcoinStreamReader, (int)stream.Length, network);
    }

    public static LockingScriptReader Read(BitcoinStreamReader bitcoinStreamReader, int expectedLength, Network network)
    {
        var reader = new LockingScriptReader(bitcoinStreamReader, expectedLength, network);
        reader.Read();

        return reader;
    }

    private void AddData(byte[] data)
    {
        Data ??= new List<byte[]>();
        Data.Add(data);
    }
}

/// <summary>
/// Holds parsed DSTAS (Distributed STAS) script fields.
/// </summary>
public class DstasInfo
{
    public byte[] Owner { get; init; }
    public byte[] ActionDataRaw { get; init; }
    public byte? ActionDataOpCode { get; init; }
    public byte[] Redemption { get; init; }
    public byte[] Flags { get; init; }
    public bool FreezeEnabled { get; init; }
    public bool ConfiscationEnabled { get; init; }
    public List<byte[]> ServiceFields { get; init; }
    public List<byte[]> OptionalData { get; init; }
}
