// push_raw_json.js
// 说明：
// 3) 推送内容为“解码后的原始 JSON”
//
// 本地需要配置的 key：
// - sinopec_enable: "1" 或 "0"
// - sinopec_push_url: 你的推送接口 URL
// - sinopec_push_token: 你的推送 token
// - sinopec_cards: JSON 数组字符串，例如 ["1000","1000"]
// - sinopec_cookie_<cardNo>: 抓包脚本写入
// - sinopec_sign_<cardNo>: 抓包脚本写入

const API_URL = "https://a.sinopecsales.com/appgas/GasCardServlet";

const ENABLE = ($prefs.valueForKey("sinopec_enable") || "1") === "1";
const PUSH_URL = $prefs.valueForKey("sinopec_push_url") || "";
const PUSH_TOKEN = $prefs.valueForKey("sinopec_push_token") || "";

function xorEncode(str) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ 0x58);
  }
  return out;
}

function xorDecode(str) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ 0x58);
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCards() {
  const raw = $prefs.valueForKey("sinopec_cards") || "";
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x).trim())
      .filter((x) => /^\d{8,}$/.test(x));
  } catch (_) {
    return [];
  }
}

async function queryOne(cardNo) {
  const cookie = $prefs.valueForKey(`sinopec_cookie_${cardNo}`) || "";
  const userSign = $prefs.valueForKey(`sinopec_sign_${cardNo}`) || "";

  if (!cookie || !userSign) {
    return {
      ok: false,
      cardNo,
      message: "missing credential",
      rawDecodedJson: null
    };
  }

  const body = xorEncode(`action=updateMainCard&cardNo=${cardNo}`);

  const req = {
    url: API_URL,
    method: "POST",
    headers: {
      "device": "iphone",
      "Cookie": cookie,
      "Connection": "keep-alive",
      "Accept-Encoding": "gzip, deflate, br",
      "version": "6.1.0",
      "AppDeviceId": "CA04D14677344BC2A9EBCFA89C42A0D4",
      "Content-Type": "application/json",
      "AppDeviceFP": "",
      "User-Agent": "yi jie jia you/6.1.0 (iPhone; iOS 26.4.2; Scale/3.00)",
      "region": "4401",
      "Host": "a.sinopecsales.com",
      "user-sign": userSign,
      "AppDeviceUUID": "CA04D14677344BC2A9EBCFA89C42A0D4",
      "Accept-Language": "zh-Hans;q=1",
      "Accept": "*/*"
    },
    body
  };

  try {
    const resp = await $task.fetch(req);
    const decoded = xorDecode(resp.body || "");

    let obj = null;
    try {
      obj = JSON.parse(decoded);
    } catch (_) {}

    if (!obj) {
      return {
        ok: false,
        cardNo,
        message: "decoded not json",
        rawDecodedText: decoded,
        rawDecodedJson: null
      };
    }

    return {
      ok: true,
      cardNo,
      message: "ok",
      rawDecodedJson: obj
    };
  } catch (e) {
    return {
      ok: false,
      cardNo,
      message: "request error: " + e,
      rawDecodedJson: null
    };
  }
}

async function pushPayload(payload) {
  return $task.fetch({
    url: PUSH_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Push-Token": PUSH_TOKEN
    },
    body: JSON.stringify(payload)
  });
}

(async () => {
  if (!ENABLE) {
    return $done();
  }

  if (!PUSH_URL || !PUSH_TOKEN) {
    $notify("Sinopec", "未配置推送参数", "请先配置 sinopec_push_url 与 sinopec_push_token");
    return $done();
  }

  const cards = loadCards();
  if (cards.length === 0) {
    $notify("Sinopec", "未配置卡号", "请在本地设置 sinopec_cards");
    return $done();
  }

  const startedAt = Date.now();
  const items = [];

  for (const cardNo of cards) {
    const r = await queryOne(cardNo);
    items.push(r);
    await sleep(1200);
  }

  const payload = {
    pushedAt: new Date().toISOString(),
    source: "quantumultx",
    items
  };

  try {
    const pushResp = await pushPayload(payload);
    const cost = Date.now() - startedAt;
    $notify("Sinopec定时推送", `完成 ${cost}ms`, `status=${pushResp.statusCode}`);
  } catch (e) {
    $notify("Sinopec定时推送", "推送失败", String(e));
  }

  $done();
})();
