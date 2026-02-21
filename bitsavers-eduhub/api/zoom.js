// /api/zoom.js — Vercel serverless function
// Proxies Zoom API calls to avoid CORS issues in the browser

export default async function handler(req, res) {
  // Allow CORS from our app
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { accountId, clientId, clientSecret, action, meetingId, userId } = req.body

  if (!accountId || !clientId || !clientSecret) {
    return res.status(400).json({ error: 'Missing Zoom credentials' })
  }

  try {
    // Step 1: Get OAuth access token
    const tokenRes = await fetch('https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + accountId, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return res.status(401).json({ error: 'Auth failed: ' + err })
    }

    const { access_token } = await tokenRes.json()

    const zoomFetch = (url) => fetch('https://api.zoom.us/v2' + url, {
      headers: { 'Authorization': 'Bearer ' + access_token }
    }).then(r => r.json())

    // Step 2: Handle different actions
    if (action === 'live') {
      // Get currently live meetings
      const data = await zoomFetch('/metrics/meetings?type=live&page_size=30')
      return res.status(200).json({ meetings: data.meetings || [] })
    }

    if (action === 'upcoming') {
      // Get upcoming scheduled meetings for the account owner
      const uid = userId || 'me'
      const data = await zoomFetch(`/users/${uid}/meetings?type=upcoming&page_size=20`)
      return res.status(200).json({ meetings: data.meetings || [] })
    }

    if (action === 'participants' && meetingId) {
      // Get live participants for a specific meeting
      const data = await zoomFetch(`/metrics/meetings/${meetingId}/participants?type=live&page_size=100`)
      return res.status(200).json({ participants: data.participants || [] })
    }

    if (action === 'meeting' && meetingId) {
      // Get details for a specific meeting
      const data = await zoomFetch(`/meetings/${meetingId}`)
      return res.status(200).json(data)
    }

    return res.status(400).json({ error: 'Unknown action' })

  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}

