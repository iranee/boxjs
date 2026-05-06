// 作用：抓 GasCardServlet 请求，按卡号保存 cookie 和 user-sign 到本地持久化

function xorDecode(str) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ 0x58);
  }
  return out;
}

function parseCardNoFromBody(rawBody) {
  if (!rawBody) return "";
  try {
    const plain = xorDecode(rawBody);
    const m = plain.match(/cardNo=(\d{8,})/);
    return m ? m[1] : "";
  } catch (_) {
    return "";
  }
}

try {
  const h = $request.headers || {};
  const cookie = h["Cookie"] || h["cookie"] || "";
  const userSign = h["user-sign"] || h["User-Sign"] || "";
  const body = $request.body || "";
  const cardNo = parseCardNoFromBody(body);

  if (cookie && userSign && cardNo) {
    $prefs.setValueForKey(cookie, `sinopec_cookie_${cardNo}`);
    $prefs.setValueForKey(userSign, `sinopec_sign_${cardNo}`);
    $prefs.setValueForKey(String(Date.now()), `sinopec_capture_ts_${cardNo}`);
    $notify("Sinopec", "凭据已保存", `cardNo=${cardNo}`);
  } else {
    console.log("capture skipped: missing cookie/sign/cardNo");
  }
} catch (e) {
  console.log("capture error: " + e);
}

$done({});
