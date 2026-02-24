import { useState, useCallback } from 'react'
import { Search, Wallet, ArrowRightLeft, Database, Plus, RefreshCw, Copy, Check, ExternalLink, ChevronDown, ChevronUp, Settings, Activity } from 'lucide-react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'https://app-jgbuodmm.fly.dev'
const CONSIGLIERE_DIRECT = 'http://13.230.42.14:5000'

type Tab = 'search' | 'admin' | 'status'

interface BalanceResult {
  address: string
  confirmed: number
  unconfirmed: number
  tokenId?: string
}

interface UtxoResult {
  txId: string
  index: number
  satoshis: number
  scriptType: number
  address: string
  tokenId?: string
}

interface HistoryEntry {
  txId: string
  height: number
  balanceChange: number
  timestamp?: string
}

interface HistoryResponse {
  items: HistoryEntry[]
  totalCount: number
}

interface TransactionData {
  hex: string
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [detectedType, setDetectedType] = useState<'address' | 'tx' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [balances, setBalances] = useState<BalanceResult[]>([])
  const [utxos, setUtxos] = useState<UtxoResult[]>([])
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [txData, setTxData] = useState<TransactionData | null>(null)
  const [showUtxos, setShowUtxos] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [searchedAddress, setSearchedAddress] = useState('')
  const [searchedTxId, setSearchedTxId] = useState('')

  const [watchAddress, setWatchAddress] = useState('')
  const [watchName, setWatchName] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const satoshisToBsv = (satoshis: number) => (satoshis / 100_000_000).toFixed(8)

  const searchAddress = async (address: string) => {
    setLoading(true)
    setError(null)
    setBalances([])
    setUtxos([])
    setHistory(null)
    setTxData(null)
    setSearchedAddress(address)
    setSearchedTxId('')
    setShowUtxos(false)
    setShowHistory(false)

    try {
      const res = await fetch(`${API_BASE}/api/address/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: [address], tokenIds: [] }),
      })
      if (!res.ok) throw new Error(`Balance API error: ${res.status}`)
      const data = await res.json()
      setBalances(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fetchUtxos = async (address: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/address/utxo-set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, tokenId: null, satoshis: null }),
      })
      if (!res.ok) throw new Error(`UTXO API error: ${res.status}`)
      const data = await res.json()
      setUtxos(data.utxos || [])
      setShowUtxos(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (address: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/address/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          tokenIds: [],
          desc: true,
          skipZeroBalance: false,
          skip: 0,
          take: 50,
        }),
      })
      if (!res.ok) throw new Error(`History API error: ${res.status}`)
      const data = await res.json()
      setHistory(data)
      setShowHistory(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const searchTransaction = async (txId: string) => {
    setLoading(true)
    setError(null)
    setBalances([])
    setUtxos([])
    setHistory(null)
    setTxData(null)
    setSearchedAddress('')
    setSearchedTxId(txId)

    try {
      const res = await fetch(`${API_BASE}/api/tx/get/${txId}`)
      if (res.status === 404) {
        setError('Transaction not found. It may not be indexed yet.')
        return
      }
      if (!res.ok) throw new Error(`Transaction API error: ${res.status}`)
      const hex = await res.text()
      setTxData({ hex })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const isLikelyTxId = (q: string) => /^[0-9a-fA-F]{64}$/.test(q)

  const handleQueryChange = (value: string) => {
    setSearchQuery(value)
    const trimmed = value.trim()
    if (!trimmed) {
      setDetectedType(null)
    } else if (isLikelyTxId(trimmed)) {
      setDetectedType('tx')
    } else {
      setDetectedType('address')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return

    if (isLikelyTxId(q)) {
      searchTransaction(q)
    } else {
      searchAddress(q)
    }
  }

  const addWatchAddress = async () => {
    if (!watchAddress || !watchName) return
    setAdminMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/manage/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: watchAddress, name: watchName }),
      })
      if (res.ok) {
        setAdminMessage({ type: 'success', text: `Address "${watchName}" added successfully` })
        setWatchAddress('')
        setWatchName('')
      } else {
        const text = await res.text()
        setAdminMessage({ type: 'error', text: text || `Error: ${res.status}` })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setAdminMessage({ type: 'error', text: msg })
    }
  }

  const addStasToken = async () => {
    if (!tokenId || !tokenSymbol) return
    setAdminMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/manage/stas-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, symbol: tokenSymbol }),
      })
      if (res.ok) {
        setAdminMessage({ type: 'success', text: `STAS Token "${tokenSymbol}" added successfully` })
        setTokenId('')
        setTokenSymbol('')
      } else {
        const text = await res.text()
        setAdminMessage({ type: 'error', text: text || `Error: ${res.status}` })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setAdminMessage({ type: 'error', text: msg })
    }
  }

  const truncate = (s: string, len = 16) =>
    s.length > len ? s.slice(0, len / 2) + '...' + s.slice(-len / 2) : s

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-white">BSV Explorer</h1>
              <p className="text-xs text-gray-400">Powered by dxs-consigliere</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`${CONSIGLIERE_DIRECT}/swagger`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-400 transition-colors"
            >
              Swagger <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-gray-700">|</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-gray-400">Mainnet</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-gray-900/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex gap-1 px-6 pt-1">
          {([
            { key: 'search' as Tab, label: 'Explorer', icon: Search },
            { key: 'admin' as Tab, label: 'Admin', icon: Settings },
            { key: 'status' as Tab, label: 'Status', icon: Activity },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === key
                  ? 'bg-gray-950 text-emerald-400 border-t-2 border-x border-t-emerald-400 border-x-gray-800'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'search' && (
          <div className="space-y-6">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Search by address or transaction ID..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  {detectedType && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full ${
                      detectedType === 'tx'
                        ? 'bg-purple-900/60 text-purple-300'
                        : 'bg-emerald-900/60 text-emerald-300'
                    }`}>
                      {detectedType === 'tx' ? 'Transaction' : 'Address'}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
            </form>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {searchedAddress && !error && (
              <div className="space-y-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-lg font-semibold">Address Details</h2>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <code className="text-sm text-emerald-300 bg-gray-800 px-3 py-1.5 rounded-lg font-mono">
                        {searchedAddress}
                      </code>
                      <button
                        onClick={() => copyToClipboard(searchedAddress, 'addr')}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {copied === 'addr' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {balances.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {balances.map((b, i) => (
                          <div key={i} className="bg-gray-800/50 rounded-lg p-4">
                            <p className="text-xs text-gray-400 mb-1">
                              {b.tokenId ? `Token: ${truncate(b.tokenId)}` : 'BSV Balance'}
                            </p>
                            <p className="text-2xl font-bold text-white">
                              {satoshisToBsv(b.confirmed)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {b.confirmed.toLocaleString()} satoshis
                            </p>
                            {b.unconfirmed !== 0 && (
                              <p className="text-xs text-yellow-400 mt-1">
                                Unconfirmed: {satoshisToBsv(b.unconfirmed)} BSV
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-800/30 rounded-lg p-4 mb-6 text-sm text-gray-400">
                        No balance data found. This address may not be watched yet. Add it in the Admin tab first.
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => showUtxos ? setShowUtxos(false) : fetchUtxos(searchedAddress)}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition-colors"
                      >
                        {showUtxos ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        UTXOs
                      </button>
                      <button
                        onClick={() => showHistory ? setShowHistory(false) : fetchHistory(searchedAddress)}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition-colors"
                      >
                        {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        History
                      </button>
                    </div>
                  </div>
                </div>

                {showUtxos && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300">
                        UTXO Set ({utxos.length})
                      </h3>
                    </div>
                    {utxos.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 text-xs border-b border-gray-800">
                              <th className="text-left px-6 py-3">TxID</th>
                              <th className="text-right px-6 py-3">Index</th>
                              <th className="text-right px-6 py-3">Amount (BSV)</th>
                              <th className="text-right px-6 py-3">Satoshis</th>
                            </tr>
                          </thead>
                          <tbody>
                            {utxos.map((u, i) => (
                              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                <td className="px-6 py-3">
                                  <button
                                    onClick={() => { setSearchQuery(u.txId); searchTransaction(u.txId); }}
                                    className="font-mono text-emerald-400 hover:text-emerald-300 text-xs"
                                  >
                                    {truncate(u.txId, 24)}
                                  </button>
                                </td>
                                <td className="text-right px-6 py-3 text-gray-300">{u.index}</td>
                                <td className="text-right px-6 py-3 text-white font-medium">{satoshisToBsv(u.satoshis)}</td>
                                <td className="text-right px-6 py-3 text-gray-400">{u.satoshis.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 text-sm text-gray-500 text-center">No UTXOs found</div>
                    )}
                  </div>
                )}

                {showHistory && history && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300">
                        Transaction History ({history.totalCount ?? history.items?.length ?? 0})
                      </h3>
                    </div>
                    {history.items && history.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 text-xs border-b border-gray-800">
                              <th className="text-left px-6 py-3">TxID</th>
                              <th className="text-right px-6 py-3">Block Height</th>
                              <th className="text-right px-6 py-3">Balance Change (BSV)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.items.map((h, i) => (
                              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                <td className="px-6 py-3">
                                  <button
                                    onClick={() => { setSearchQuery(h.txId); searchTransaction(h.txId); }}
                                    className="font-mono text-emerald-400 hover:text-emerald-300 text-xs"
                                  >
                                    {truncate(h.txId, 24)}
                                  </button>
                                </td>
                                <td className="text-right px-6 py-3 text-gray-300">
                                  {h.height > 0 ? h.height.toLocaleString() : 'Unconfirmed'}
                                </td>
                                <td className={`text-right px-6 py-3 font-medium ${h.balanceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {h.balanceChange >= 0 ? '+' : ''}{satoshisToBsv(h.balanceChange)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 text-sm text-gray-500 text-center">No history found</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {searchedTxId && txData && !error && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                  <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold">Transaction Details</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Transaction ID</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-emerald-300 bg-gray-800 px-3 py-1.5 rounded-lg font-mono break-all">
                        {searchedTxId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(searchedTxId, 'txid')}
                        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        {copied === 'txid' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Raw Transaction (Hex)</p>
                    <div className="relative">
                      <pre className="bg-gray-800 rounded-lg p-4 text-xs text-gray-300 font-mono overflow-x-auto max-h-48 overflow-y-auto break-all whitespace-pre-wrap">
                        {txData.hex}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(txData.hex, 'txhex')}
                        className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 p-1.5 rounded transition-colors"
                      >
                        {copied === 'txhex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Size: {(txData.hex.length / 2).toLocaleString()} bytes
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!searchedAddress && !searchedTxId && !error && (
              <div className="text-center py-20">
                <Database className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-400 mb-2">BSV Blockchain Explorer</h2>
                <p className="text-gray-600 text-sm max-w-md mx-auto">
                  Search for BSV addresses to view balances, UTXOs, and transaction history.
                  Search for transaction IDs to view raw transaction data.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-left max-w-xs">
                    <Wallet className="w-5 h-5 text-emerald-400 mb-2" />
                    <p className="text-sm font-medium text-gray-300">Address Lookup</p>
                    <p className="text-xs text-gray-500 mt-1">View balances, UTXOs, and transaction history for watched addresses</p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-left max-w-xs">
                    <ArrowRightLeft className="w-5 h-5 text-emerald-400 mb-2" />
                    <p className="text-sm font-medium text-gray-300">Transaction Search</p>
                    <p className="text-xs text-gray-500 mt-1">Look up raw transaction data by transaction ID</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">Admin Panel</h2>

            {adminMessage && (
              <div className={`rounded-lg px-4 py-3 text-sm ${
                adminMessage.type === 'success'
                  ? 'bg-emerald-900/30 border border-emerald-800 text-emerald-300'
                  : 'bg-red-900/30 border border-red-800 text-red-300'
              }`}>
                {adminMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold">Add Watch Address</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">BSV Address</label>
                    <input
                      type="text"
                      value={watchAddress}
                      onChange={(e) => setWatchAddress(e.target.value)}
                      placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Label / Name</label>
                    <input
                      type="text"
                      value={watchName}
                      onChange={(e) => setWatchName(e.target.value)}
                      placeholder="My Wallet"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={addWatchAddress}
                    disabled={!watchAddress || !watchName}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Address
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold">Add STAS Token</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Token ID</label>
                    <input
                      type="text"
                      value={tokenId}
                      onChange={(e) => setTokenId(e.target.value)}
                      placeholder="542a56ec7a307fd68bf925d8f4d525ca61e868ad"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Symbol</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      placeholder="USDT-TON"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={addStasToken}
                    disabled={!tokenId || !tokenSymbol}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add STAS Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">System Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-900/50 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">API Server</p>
                    <p className="text-xs text-gray-400">Consigliere</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm text-emerald-400">Online</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{API_BASE}</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-900/50 flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">RavenDB</p>
                    <p className="text-xs text-gray-400">Document Store</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm text-emerald-400">Online</span>
                </div>
                <a
                  href={`${CONSIGLIERE_DIRECT.replace(':5000', ':8080')}/studio/index.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-flex items-center gap-1"
                >
                  Open Studio <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-900/50 flex items-center justify-center">
                    <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">JungleBus</p>
                    <p className="text-xs text-gray-400">GorillaPool</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm text-emerald-400">Connected</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Mainnet Subscription Active</p>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="font-semibold">API Endpoints</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-gray-800">
                      <th className="text-left px-6 py-3">Method</th>
                      <th className="text-left px-6 py-3">Endpoint</th>
                      <th className="text-left px-6 py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['POST', '/api/address/balance', 'Get address balances'],
                      ['POST', '/api/address/utxo-set', 'Get UTXO set for address'],
                      ['POST', '/api/address/batch/utxo-set', 'Batch UTXO set query'],
                      ['POST', '/api/address/history', 'Get transaction history'],
                      ['POST', '/api/admin/manage/address', 'Add watch address'],
                      ['POST', '/api/admin/manage/stas-token', 'Add STAS token'],
                      ['GET', '/api/tx/get/{id}', 'Get transaction by ID'],
                      ['GET', '/api/tx/batch/get', 'Batch transaction query'],
                      ['GET', '/api/tx/by-height/get', 'Get transactions by block'],
                      ['POST', '/api/tx/broadcast/{raw}', 'Broadcast transaction'],
                      ['GET', '/api/tx/stas/validate/{id}', 'Validate STAS transaction'],
                    ].map(([method, endpoint, desc], i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-6 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            method === 'POST' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-emerald-900/50 text-emerald-300'
                          }`}>
                            {method}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-xs text-gray-300">{endpoint}</td>
                        <td className="px-6 py-3 text-gray-400">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 mt-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <span>dxs-consigliere BSV Explorer</span>
          <span>Network: BSV Mainnet</span>
        </div>
      </footer>
    </div>
  )
}

export default App
