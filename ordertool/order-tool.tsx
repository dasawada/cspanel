"use client"

import { useState, useRef } from "react"
import { Search, Copy, RotateCcw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function OrderTool() {
  // State for deal ID input
  const [dealId, setDealId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState("等待搜尋...")
  const [orderLink, setOrderLink] = useState("")
  const [iframeUrl, setIframeUrl] = useState("about:blank")

  // State for sheet fields
  const [sheetData, setSheetData] = useState({
    colA: "",
    colB: "",
    colC: "",
    colD: "",
    colE: "",
    colF: "",
    colG: "",
    colH: "",
    colI: "",
    colJ: "",
    colK: "",
    colL: "",
    colM: "",
  })
  const [oneClubCustomers, setOneClubCustomers] = useState([])
  const [selectedOneClubId, setSelectedOneClubId] = useState("")

  // Previous data for restore functionality
  const [previousData, setPreviousData] = useState(null)

  // Team sheet data cache
  const teamSheetDataCache = useRef(null)

  // Constants for API endpoints
  const TEAM_SHEET_ENDPOINT =
    "https://sheets.googleapis.com/v4/spreadsheets/15TsK4mB_zfH6SGqTvUe1AOYzwQfE90Z8gN1Gf5tiYLU/values/wtf?key=AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw"
  const ONE_CLUB_SEARCH_API = "https://api.oneclass.co/staff/customers?skip=0&limit=50&name="
  const ONE_CLUB_JWT =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vbXlhY2NvdW50Lm5hbmkuY29vbC8iLCJzdWIiOiJ1c2Vycy9PTkVXVDAwNzQ1IiwiZnJvbSI6Ik5hbmkiLCJ1c2VybmFtZSI6Ik9ORVdUMDA3NDUiLCJlbWFpbHZhbGlkIjp0cnVlLCJtb2JpbGV2YWxpZCI6ZmFsc2UsImVtYWlsIjoiamltbXkuY2hpZW4udHBAb25lY2xhc3MudHciLCJ1aWQiOiI3NDBkNWUwMC1mYjA3LTExZWUtYTIxZS0yZmJlN2I4NTkxY2EiLCJqdGkiOiI0ZTdlNTM0Yy1mMzgyLTQ1ZGUtOGFhYS1lODE2OTE0YWY1Y2YiLCJpYXQiOjE3MzkxNjM5NjksImV4cCI6MTc0NDM0Nzk2OX0.uNm_yUQfEA5Q3BUgmas7bfomOP3-n5kE0xWRoAVhSPI"

  // Function to fetch team sheet data
  async function fetchTeamSheetData() {
    if (teamSheetDataCache.current) return teamSheetDataCache.current

    const res = await fetch(TEAM_SHEET_ENDPOINT)
    if (!res.ok) {
      throw new Error(`顧問組別 GoogleSheet API 錯誤: ${res.status}`)
    }

    const data = await res.json()
    teamSheetDataCache.current = data.values || []
    return teamSheetDataCache.current
  }

  // Function to find team code for consultant
  function findTeamCodeForConsultant(name, sheetData) {
    if (!name || !sheetData) return ""

    const searchKey = name.replace(/\s+/g, "").toLowerCase()
    for (let r = 0; r < sheetData.length; r++) {
      for (let c = 0; c < sheetData[r].length; c++) {
        const cellVal = (sheetData[r][c] || "").replace(/\s+/g, "").toLowerCase()
        if (cellVal === searchKey) {
          if (sheetData[2] && sheetData[2][c]) {
            return sheetData[2][c]
          }
        }
      }
    }
    return ""
  }

  // Function to search OneClub customers
  async function searchOneClubCustomers(name) {
    if (!name) return []

    const url = ONE_CLUB_SEARCH_API + encodeURIComponent(name.trim())
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ONE_CLUB_JWT}`,
        Accept: "application/json, text/plain, */*",
      },
    })

    if (!res.ok) {
      throw new Error(`OneClub搜尋API錯誤: ${res.status}`)
    }

    const jsonData = await res.json()
    return jsonData.data && jsonData.data.customers ? jsonData.data.customers : []
  }

  // Function to fetch deal info
  async function fetchDealInfo() {
    const cleanDealId = dealId.trim().replace(/[^A-Za-z0-9]/g, "")
    setDealId(cleanDealId)

    if (!cleanDealId) {
      setResult("請輸入有效的交易編號!")
      return
    }

    setIsLoading(true)
    setResult("查詢中...")
    clearSheetFields()

    const bitrixUrl = `https://oneclass.bitrix24.com/rest/112707/9f69cv00y4xkrx87/crm.deal.get?ID=${cleanDealId}`

    try {
      const bitrixRes = await fetch(bitrixUrl)
      if (!bitrixRes.ok) {
        throw new Error(`Bitrix查詢失敗: ${bitrixRes.status}`)
      }

      const bitrixJson = await bitrixRes.json()
      if (bitrixJson.error) {
        throw new Error(`Bitrix API錯誤: ${bitrixJson.error_description}`)
      }

      const dealData = bitrixJson.result || {}
      const notes = dealData.UF_CRM_1646312993 ? dealData.UF_CRM_1646312993.replace(/\r\n/g, "\n") : "無備註"
      const orderLink = dealData.UF_CRM_1646313465 || "無可用連結"
      const contactId = dealData.CONTACT_ID || ""
      const contactLink = contactId ? `https://oneclass.bitrix24.com/crm/contact/details/${contactId}/` : ""

      setIframeUrl(orderLink === "無可用連結" ? "about:blank" : orderLink)
      setOrderLink(orderLink)

      const dealLink = `https://oneclass.bitrix24.com/crm/deal/details/${cleanDealId}/`
      setResult(
        `【備註】\n${notes}\n\n` + `【Bitrix交易連結】\n${dealLink}\n` + `【聯絡人連結】\n${contactLink || "無"}`,
      )

      if (orderLink !== "無可用連結") {
        const match = orderLink.match(/order\/(\w+)/)
        const orderId = match ? match[1] : ""
        if (orderId) {
          await fetchOrderData(orderId, cleanDealId, contactLink)
        }
      }
    } catch (err) {
      setResult("錯誤：" + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Function to fetch order data
  async function fetchOrderData(orderId, bitrixDealId, contactLink) {
    const orderApi = `https://api.oneclass.co/product/open/orders/${orderId}/`

    try {
      const res = await fetch(orderApi)
      if (!res.ok) {
        throw new Error(`OneClass訂單API錯誤: ${res.status}`)
      }

      const jsonData = await res.json()
      const data = jsonData.data || {}

      // Create new sheet data object
      const newSheetData = { ...sheetData }

      // A：當天日期
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, "0")
      const dd = String(now.getDate()).padStart(2, "0")
      newSheetData.colA = `${mm}/${dd}`

      // B：比對 crmNo
      const crmNo = data.crmNo ? String(data.crmNo) : ""
      newSheetData.colB = crmNo === bitrixDealId ? crmNo : `${bitrixDealId}【需核對】`

      // C：聯絡人頁面
      newSheetData.colC = contactLink

      // D：留空
      newSheetData.colD = ""

      // E：顧問組別-姓名
      let advisorName = ""
      if (data.managers && data.managers.length > 0) {
        advisorName = data.managers[0].name || ""
      }

      if (advisorName) {
        let teamStr = ""
        try {
          const sheetData = await fetchTeamSheetData()
          teamStr = findTeamCodeForConsultant(advisorName, sheetData)
        } catch (e) {
          console.warn("顧問組別搜尋失敗", e)
        }

        if (teamStr) {
          const trimmed = teamStr.replace(/^TEAM/i, "")
          newSheetData.colE = `${trimmed}組-${advisorName}`
        } else {
          newSheetData.colE = advisorName
        }
      }

      // F：學生名單
      if (data.students && Array.isArray(data.students)) {
        const names = data.students.map((s) => s.name).join("＆")
        newSheetData.colF = names
      }

      // G：客戶名稱
      const customerName = (data.customerInfo && data.customerInfo.name) || ""
      newSheetData.colG = customerName

      // H, I, J, K, L 留空
      newSheetData.colH = ""
      newSheetData.colI = ""
      newSheetData.colJ = ""
      newSheetData.colK = ""
      newSheetData.colL = ""

      // M：金額
      newSheetData.colM = data.amt || ""

      // Update sheet data
      setSheetData(newSheetData)

      // N：以家長姓名搜尋 OneClub ID
      let customers = []
      if (customerName) {
        customers = await searchOneClubCustomers(customerName)
        setOneClubCustomers(customers)

        if (customers.length === 1) {
          setSelectedOneClubId(customers[0].oneClubId || "")
        } else if (customers.length > 1) {
          setSelectedOneClubId(customers[0].oneClubId || "")
        }
      } else {
        setOneClubCustomers([])
        setSelectedOneClubId("")
      }

      // Save sheet data for restore functionality
      setPreviousData({
        sheetData: { ...newSheetData },
        oneClubCustomers: [...customers],
        selectedOneClubId: selectedOneClubId,
      })
    } catch (err) {
      setResult((prev) => prev + "\n錯誤：" + err.message)
    }
  }

  // Function to clear sheet fields
  function clearSheetFields() {
    setSheetData({
      colA: "",
      colB: "",
      colC: "",
      colD: "",
      colE: "",
      colF: "",
      colG: "",
      colH: "",
      colI: "",
      colJ: "",
      colK: "",
      colL: "",
      colM: "",
    })
    setOneClubCustomers([])
    setSelectedOneClubId("")
  }

  // Function to restore sheet data
  function restoreSheetData() {
    if (!previousData) return

    setSheetData(previousData.sheetData)
    setOneClubCustomers(previousData.oneClubCustomers)
    setSelectedOneClubId(previousData.selectedOneClubId)
  }

  // Function to copy sheet data
  function copySheetData() {
    const rowData = []

    // A to L columns
    for (let c = "A".charCodeAt(0); c <= "L".charCodeAt(0); c++) {
      const colId = "col" + String.fromCharCode(c)
      let val = sheetData[colId] || ""
      val = val.replace(/\r?\n/g, " / ")
      rowData.push(val)
    }

    // M column
    rowData.push(sheetData.colM || "")

    // N column (OneClub ID)
    rowData.push(selectedOneClubId || "")

    const tsvLine = rowData.join("\t")

    navigator.clipboard
      .writeText(tsvLine)
      .then(() => {
        alert("已複製 A~N 欄位到剪貼簿！")
      })
      .catch((err) => {
        console.error("複製失敗:", err)

        // Fallback for browsers that don't support clipboard API
        const temp = document.createElement("textarea")
        temp.value = tsvLine
        document.body.appendChild(temp)
        temp.select()
        document.execCommand("copy")
        document.body.removeChild(temp)
        alert("已複製 A~N 欄位到剪貼簿！")
      })
  }

  // Handle Enter key press
  function handleKeyPress(e) {
    if (e.key === "Enter") {
      fetchDealInfo()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-purple-200/30 blur-[80px] -z-10"></div>
      <div className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-blue-200/30 blur-[100px] -z-10"></div>

      <div className="max-w-[1600px] mx-auto grid md:grid-cols-[350px_1fr] gap-6">
        {/* Left Panel */}
        <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/20 shadow-lg p-5 h-fit">
          <div className="flex gap-2 mb-4">
            <Input
              type="text"
              placeholder="輸入Deal ID"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              onKeyPress={handleKeyPress}
              className="bg-white/80 border-gray-200"
            />
            <Button
              onClick={fetchDealInfo}
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              <Search className="w-4 h-4 mr-2" />
              搜尋
            </Button>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100 p-4 h-[calc(100vh-200px)] overflow-auto">
            <pre className="whitespace-pre-wrap text-sm">{result}</pre>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-6">
          {/* Table Container - Google Sheet Style */}
          <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/20 shadow-lg p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-700">訂單資料表</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={restoreSheetData} className="border-gray-300 hover:bg-gray-100">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  復原
                </Button>
                <Button
                  onClick={copySheetData}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  複製
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      A<br />
                      轉單日
                    </th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      B<br />
                      交編
                    </th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      C<br />
                      聯絡人
                    </th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">D</th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      E<br />
                      顧問
                    </th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      F<br />
                      學員名
                    </th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      G<br />
                      立約人
                    </th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">H</th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">I</th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">J</th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">K</th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">L</th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      M<br />
                      金額
                    </th>
                    <th className="p-2 bg-gray-50 border border-gray-200 text-sm font-medium text-gray-600">
                      N<br />
                      OCID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colA"
                        placeholder="mm/dd"
                        value={sheetData.colA}
                        onChange={(e) => setSheetData({ ...sheetData, colA: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colB"
                        placeholder="交易編號"
                        value={sheetData.colB}
                        onChange={(e) => setSheetData({ ...sheetData, colB: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colC"
                        placeholder="聯絡人頁面"
                        value={sheetData.colC}
                        onChange={(e) => setSheetData({ ...sheetData, colC: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colD"
                        placeholder="留空/商品"
                        value={sheetData.colD}
                        onChange={(e) => setSheetData({ ...sheetData, colD: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colE"
                        placeholder="顧問組別-姓名"
                        value={sheetData.colE}
                        onChange={(e) => setSheetData({ ...sheetData, colE: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colF"
                        placeholder="學生名單"
                        value={sheetData.colF}
                        onChange={(e) => setSheetData({ ...sheetData, colF: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colG"
                        placeholder="客戶名稱"
                        value={sheetData.colG}
                        onChange={(e) => setSheetData({ ...sheetData, colG: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colH"
                        placeholder=""
                        value={sheetData.colH}
                        onChange={(e) => setSheetData({ ...sheetData, colH: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colI"
                        placeholder=""
                        value={sheetData.colI}
                        onChange={(e) => setSheetData({ ...sheetData, colI: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colJ"
                        placeholder=""
                        value={sheetData.colJ}
                        onChange={(e) => setSheetData({ ...sheetData, colJ: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colK"
                        placeholder=""
                        value={sheetData.colK}
                        onChange={(e) => setSheetData({ ...sheetData, colK: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colL"
                        placeholder=""
                        value={sheetData.colL}
                        onChange={(e) => setSheetData({ ...sheetData, colL: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200">
                      <Input
                        id="colM"
                        placeholder="金額"
                        value={sheetData.colM}
                        onChange={(e) => setSheetData({ ...sheetData, colM: e.target.value })}
                        className="border-0 rounded-none h-10 focus:ring-1 focus:ring-blue-500 bg-white/80"
                      />
                    </td>
                    <td className="p-0 border border-gray-200 min-w-[120px]">
                      <div className="p-1 h-10 overflow-hidden bg-white/80">
                        {oneClubCustomers.length === 0 ? (
                          <span className="text-gray-500 text-xs">無對應ID</span>
                        ) : oneClubCustomers.length === 1 ? (
                          <span className="text-xs">{oneClubCustomers[0].oneClubId || ""}</span>
                        ) : (
                          <select
                            className="w-full h-full border-0 bg-transparent text-xs focus:ring-0"
                            value={selectedOneClubId}
                            onChange={(e) => setSelectedOneClubId(e.target.value)}
                          >
                            {oneClubCustomers.map((customer, index) => (
                              <option key={index} value={customer.oneClubId || ""}>
                                {customer.name} ({customer.oneClubId || "?"})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* iframe Container */}
          <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/20 shadow-lg flex flex-col flex-grow">
            <div className="flex-grow relative min-h-[400px]">
              <iframe src={iframeUrl} className="absolute inset-0 w-full h-full rounded-t-xl" />
            </div>

            <div className="p-3 border-t border-gray-200 bg-white/80 backdrop-blur-sm rounded-b-xl">
              <div className="flex items-center justify-center gap-2 text-sm">
                <strong>OneClass商品訂單連結:</strong>
                {orderLink && orderLink !== "無可用連結" ? (
                  <a
                    href={orderLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center"
                  >
                    {orderLink.length > 50 ? orderLink.substring(0, 50) + "..." : orderLink}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                ) : (
                  <span className="text-gray-500">無可用連結</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

