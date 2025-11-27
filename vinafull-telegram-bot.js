const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const tough = require("tough-cookie");
const TelegramBot = require("node-telegram-bot-api");

// ================== CẤU HÌNH TELEGRAM (THAY 2 DÒNG NÀY) ==================
const TELEGRAM_TOKEN = "8474970785:AAFKhklsNEDVwPMbT45SFJJDZcMoCgl-MfQ"; // Thay bằng token thật
const CHAT_ID = "891405971"; // Thay bằng ID thật

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Gửi tin nhắn Telegram (có retry)
async function sendTelegram(message) {
  try {
    await bot.sendMessage(CHAT_ID, message, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error("Lỗi gửi Telegram:", err.message);
  }
}

// ================== CẤU HÌNH VINA ==================
const CODE = "7443247a-4bb0-4aa3-94a5-98b712597004"; // Thay code nếu cần

const cookieJar = new tough.CookieJar();

const client = wrapper(
  axios.create({
    jar: cookieJar,
    withCredentials: true,
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Origin: "https://vinafull.com",
      Referer: "https://vinafull.com/tool",
    },
  })
);

const LOGIN_URL = "https://vinafull.com/login";
const PACKET_URL = "https://vinafull.com/packet";

let roundCount = 0;

// ================== ĐĂNG NHẬP ==================
async function login() {
  console.log("Đang đăng nhập...");
  try {
    await client.post(LOGIN_URL, `code=${encodeURIComponent(CODE)}`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    await sendTelegram(
      `<b>VINAFULL BOT KHỞI ĐỘNG THÀNH CÔNG</b>\nCode: <code>${CODE}</code>\nBắt đầu farm mỗi 60 giây`
    );
    console.log("Đăng nhập thành công!\n");
  } catch (error) {
    const err = error.response?.data || error.message || "Unknown";
    await sendTelegram(
      `<b>ĐĂNG NHẬP THẤT BẠI</b>\nCode: <code>${CODE}</code>\nLỗi: <code>${err}</code>`
    );
    console.error("Login failed:", err);
    process.exit(1);
  }
}

// ================== CHUỖI FARM 3 BƯỚC ==================
async function doWaterfall() {
  roundCount++;
  const steps = [
    { mode: "arena-fight", emoji: "Sword", name: "Đánh Arena" },
    { mode: "arena-win", emoji: "Trophy", name: "Nhận thắng" },
    { mode: "warrior-chest", emoji: "Chest", name: "Mở rương" },
  ];

  let lines = [
    `<b>VÒNG ${roundCount} • ${new Date().toLocaleString("vi-VN")}</b>`,
  ];

  for (const step of steps) {
    try {
      const res = await client.post(PACKET_URL, `mode=${step.mode}`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      // SỬA ĐÚNG DÒNG NÀY – KHÔNG CÒN LỖI SYNTAX
      let text =
        typeof res.data === "string"
          ? res.data.trim()
          : JSON.stringify(res.data);
      if (text.length > 200) text = text.substring(0, 197) + "...";

      lines.push(`${step.emoji} <b>${step.name}:</b> <code>${text}</code>`);
      console.log(`${step.emoji} ${step.name} → OK`);
    } catch (error) {
      const err = error.response?.data || error.message || "No response";
      lines.push(
        `${step.emoji} <b>${step.name}:</b> <code>LỖI → ${err}</code>`
      );
      console.error(`${step.emoji} ${step.name} lỗi:`, err);
    }

    await new Promise((r) => setTimeout(r, 1200)); // delay nhẹ
  }

  await sendTelegram(lines.join("\n"));
}

// ================== KHỞI ĐỘNG ==================
(async () => {
  await login().then(() => {
    doWaterfall(); // chạy lần đầu ngay

    setInterval(doWaterfall, 60_000); // lặp lại mỗi 60s

    console.log("Bot đang chạy ổn định – nhận thông báo Telegram mỗi phút!\n");
  });
})();

// Bắt lỗi toàn cục để bot không chết
process.on("uncaughtException", (err) => {
  sendTelegram(`<b>BOT CRASH</b>\n<code>${err.message}</code>`);
  console.error("Crash:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  sendTelegram(`<b>PROMISE LỖI</b>\n<code>${err}</code>`);
});
