namespace Dxs.Bsv.Script;

/// <summary>
/// Validates identity fields used in DSTAS scripts.
/// Owner and service fields can be either a 20-byte PKH or a canonical MPKH preimage.
/// </summary>
public static class IdentityField
{
    /// <summary>
    /// Checks if a compressed public key (33 bytes, prefix 0x02 or 0x03).
    /// </summary>
    private static bool IsCompressedPubKey(byte[] key) =>
        key.Length == 33 && (key[0] == 0x02 || key[0] == 0x03);

    /// <summary>
    /// Validates a canonical MPKH (Multi-Public-Key-Hash) preimage field.
    /// Format: [m] [0x21 pubkey1] [0x21 pubkey2] ... [n]
    /// where m <= n, n <= 5, each pubkey is 33 bytes compressed.
    /// Total length = 1 + n*34 + 1
    /// </summary>
    public static bool IsCanonicalMpkhField(byte[] value)
    {
        if (value.Length < 36) return false;

        var m = value[0];
        var n = value[value.Length - 1];

        if (n <= 0 || n > 5) return false;
        if (m <= 0 || m > n) return false;
        if (value.Length != 1 + n * 34 + 1) return false;

        var offset = 1;
        for (var i = 0; i < n; i++)
        {
            if (value[offset] != 0x21) return false;

            var key = new byte[33];
            System.Array.Copy(value, offset + 1, key, 0, 33);
            if (!IsCompressedPubKey(key)) return false;

            offset += 34;
        }

        return offset == value.Length - 1;
    }

    /// <summary>
    /// Checks if a value is a supported identity field: either 20-byte PKH or canonical MPKH preimage.
    /// </summary>
    public static bool IsSupportedIdentityField(byte[] value) =>
        value.Length == 20 || IsCanonicalMpkhField(value);
}
