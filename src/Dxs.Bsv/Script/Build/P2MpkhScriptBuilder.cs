namespace Dxs.Bsv.Script.Build;

/// <summary>
/// Builds a P2MPKH (Pay-to-Multi-Public-Key-Hash) locking script.
/// Supports both single-key (OP_CHECKSIG) and multi-key up to 5 (OP_CHECKMULTISIG).
/// </summary>
public class P2MpkhScriptBuilder : ScriptBuilder
{
    private bool _isOpReturnAdded;

    public P2MpkhScriptBuilder(Address toAddress) : base(ScriptType.P2MPKH, toAddress)
    {
        foreach (var token in ScriptSamples.P2MpkhTokens)
        {
            if (token.IsReceiverId)
            {
                Tokens.Add(new(ToAddress.Hash160)
                {
                    IsReceiverId = true
                });
            }
            else
            {
                Tokens.Add(token.Clone());
            }
        }
    }

    public void AddReturnData(byte[] data)
    {
        if (!_isOpReturnAdded)
        {
            AddOpCode(OpCode.OP_RETURN);
            _isOpReturnAdded = true;
        }

        AddData(data);
    }
}
