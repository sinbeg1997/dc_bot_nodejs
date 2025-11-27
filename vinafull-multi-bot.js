// vinafull-multi-bot.js
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const tough = require("tough-cookie");

// Danh sách tài khoản (dễ thêm/bớt)
const ACCOUNTS = [
  { name: "SinhHN", code: "d9fd932e-4853-4d1a-b8f3-2c9cf71770fe" },
  { name: "bean02", code: "7443247a-4bb0-4aa3-94a5-98b712597004" },
  { name: "dogfish65", code: "ac88872c-db4f-480b-bb04-54ba159fd400" },
  { name: "thedeepcat", code: "6a10e57f-9114-4269-8e60-edabda464c9e" },
  // Thêm tài khoản mới ở đây ↓
  // { name: "ten_tai_khoan", code: "uuid-cua-ban" },
];

const LOGIN_URL = "https://vinafull.com/login";
const PACKET_URL = "https://vinafull.com/packet";

// Các bước farm (giống người thật)
const WATERFALL_STEPS = [
  { mode: "arena-fight", name: "Đánh Arena" },
  { mode: "arena-win", name: "Nhận thắng Arena" },
  { mode: "warrior-chest", name: "Mở rương chiến binh" },
];

// Tạo client riêng cho từng tài khoản (cookie độc lập)
function createClient(accountName) {
  const cookieJar = new tough.CookieJar();

  return wrapper(
    axios.create({
      jar: cookieJar,
      withCredentials: true,
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        Origin: "https://vinafull.com",
        Referer: "https://vinafull.com/tool",
      },
    })
  );
}

// Đăng nhập 1 tài khoản
async function login(client, account) {
  try {
    await client.post(LOGIN_URL, `code=${encodeURIComponent(account.code)}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://vinafull.com/tool",
      },
    });
    console.log(`[${timeNow()}] ✅ [${account.name}] Đăng nhập thành công`);
    return true;
  } catch (err) {
    const msg = err.response?.data || err.message;
    console.error(
      `[${timeNow()}] ❌ [${account.name}] Đăng nhập thất bại →`,
      msg
    );
    return false;
  }
}

// Thực hiện chuỗi farm cho 1 tài khoản
async function doWaterfall(client, account) {
  for (const step of WATERFALL_STEPS) {
    try {
      const res = await client.post(PACKET_URL, `mode=${step.mode}`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
        },
      });

      const result =
        typeof res.data === "object" ? JSON.stringify(res.data) : res.data;
      const output = result.trim() || "OK";

      console.log(
        `[${timeNow()}] 🎯 [${account.name}] ${step.name} → ${output}`
      );
    } catch (err) {
      const errMsg = err.response?.data || err.message;
      console.error(
        `[${timeNow()}] ⚠️ [${account.name}] ${step.name} thất bại →`,
        errMsg
      );
    }

    // Nghỉ ngẫu nhiên 1-2.5s để giống người thật
    await delay(1000 + Math.random() * 1500);
  }
}

// Hàm delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Lấy thời gian hiện tại đẹp
function timeNow() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

// Bot chính cho 1 tài khoản
async function runBotForAccount(account) {
  const client = createClient(account.name);

  // Đăng nhập trước
  const loggedIn = await login(client, account);
  if (!loggedIn) {
    console.log(
      `[${timeNow()}] ⏹️ [${account.name}] Dừng bot vì đăng nhập thất bại`
    );
    return;
  }

  // Chạy lần đầu ngay lập tức
  console.log(`[${timeNow()}] 🚀 [${account.name}] Bắt đầu farm...`);
  await doWaterfall(client, account);

  // Sau đó lặp lại mỗi ~60-65 giây (random nhẹ để tránh bị detect)
  setInterval(async () => {
    const nextRunIn = 60 + Math.floor(Math.random() * 10); // 60-70s
    console.log(
      `\n[${timeNow()}] 🔄 [${account.name}] --- Vòng mới sau ${nextRunIn}s ---`
    );
    await doWaterfall(client, account);
  }, (60 + Math.random() * 10) * 1000);
}

// === KHỞI ĐỘNG TẤT CẢ TÀI KHOẢN ===
console.log(
  `\n🤖 Vinafull Multi-Bot khởi động - ${ACCOUNTS.length} tài khoản\n`
);

ACCOUNTS.forEach((acc, index) => {
  // Stagger khởi động mỗi tài khoản cách nhau 3-8 giây để tránh flood server
  setTimeout(() => {
    runBotForAccount(acc).catch((err) => {
      console.error(`[${timeNow()}] 💥 [${acc.name}] Lỗi nghiêm trọng:`, err);
    });
  }, index * (3000 + Math.random() * 5000));
});
