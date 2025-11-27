// vinafull-pro-bot.js - Bot Telegram + Multi Account + Notify + Control
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const tough = require("tough-cookie");
const { Telegraf } = require("telegraf");

// ================== CẤU HÌNH ==================
const TELEGRAM_BOT_TOKEN = "8474970785:AAFKhklsNEDVwPMbT45SFJJDZcMoCgl-MfQ"; // Thay bằng token của bạn
const TELEGRAM_CHAT_ID = "891405971"; // Thay bằng chat id của bạn (số)

const ACCOUNTS = [
  { name: "SinhHN", code: "d9fd932e-4853-4d1a-b8f3-2c9cf71770fe" },
  { name: "bean02", code: "7443247a-4bb0-4aa3-94a5-98b712597004" },
  { name: "dogfish65", code: "ac88872c-db4f-480b-bb04-54ba159fd400" },
  { name: "thedeepcat", code: "6a10e57f-9114-4269-8e60-edabda464c9e" },
  // Thêm tài khoản thoải mái
];

const LOGIN_URL = "https://vinafull.com/login";
const PACKET_URL = "https://vinafull.com/packet";

const WATERFALL_STEPS = [
  { mode: "arena-fight", name: "Đánh Arena" },
  { mode: "arena-win", name: "Nhận thắng Arena" },
  { mode: "warrior-chest", name: "Mở rương chiến binh" },
];

// ================== BIẾN TOÀN CỤC ==================
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
let bots = {}; // { accountName: { client, interval, running: true } }
let isGlobalRunning = true;

// ================== HỖ TRỢ ==================
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const timeNow = () => new Date().toLocaleTimeString("vi-VN", { hour12: false });

async function sendTelegram(msg) {
  try {
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, msg, {
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error("Lỗi gửi Telegram:", err.message);
  }
}

function createClient() {
  const jar = new tough.CookieJar();
  return wrapper(
    axios.create({
      jar,
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

// ================== ĐĂNG NHẬP & FARM ==================
async function login(client, account) {
  try {
    await client.post(LOGIN_URL, `code=${encodeURIComponent(account.code)}`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    await sendTelegram(`✅ <b>${account.name}</b> → Đăng nhập thành công`);
    return true;
  } catch (err) {
    const msg = err.response?.data || err.message;
    await sendTelegram(
      `❌ <b>${account.name}</b> → Đăng nhập thất bại\n<code>${msg}</code>`
    );
    return false;
  }
}

async function doWaterfall(client, account) {
  for (const step of WATERFALL_STEPS) {
    if (!isGlobalRunning || !bots[account.name]?.running) return;

    try {
      const res = await client.post(PACKET_URL, `mode=${step.mode}`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const result =
        typeof res.data === "object"
          ? JSON.stringify(res.data)
          : (res.data || "").trim();
      const output = result || "OK";

      const icon =
        output.includes("thành công") || output === "OK" ? "✅" : "⚠️";
      await sendTelegram(
        `${icon} <b>${account.name}</b> → ${step.name}\n<code>${output}</code>`
      );
    } catch (err) {
      const msg = err.response?.data || err.message;
      await sendTelegram(
        `❌ <b>${account.name}</b> → ${step.name} thất bại\n<code>${msg}</code>`
      );
    }
    await delay(1200 + Math.random() * 1800);
  }
}

// ================== CHẠY BOT CHO 1 TÀI KHOẢN ==================
async function startAccountBot(account) {
  if (bots[account.name]) {
    clearInterval(bots[account.name].interval);
  }

  const client = createClient();
  const loggedIn = await login(client, account);
  if (!loggedIn) {
    bots[account.name] = { running: false };
    return;
  }

  // Chạy lần đầu
  await doWaterfall(client, account);

  // Lặp lại mỗi 60-70s
  const interval = setInterval(async () => {
    if (isGlobalRunning && bots[account.name]?.running) {
      await sendTelegram(`\n🔄 <b>${account.name}</b> — Vòng farm mới —`);
      await doWaterfall(client, account);
    }
  }, (60 + Math.random() * 10) * 1000);

  bots[account.name] = { client, interval, running: true };
}

// ================== LỆNH TELEGRAM ==================
bot.start((ctx) =>
  ctx.reply("🚀 Vinafull Pro Bot đã sẵn sàng!\nDùng /status /stop /relogin")
);

bot.command("status", async (ctx) => {
  const running = Object.keys(bots).filter(
    (name) => bots[name]?.running
  ).length;
  await ctx.reply(
    `📊 Trạng thái: ${
      isGlobalRunning ? "ĐANG CHẠY" : "ĐÃ DỪNG"
    }\n👥 Tài khoản hoạt động: ${running}/${ACCOUNTS.length}`
  );
});

bot.command("stop", async (ctx) => {
  isGlobalRunning = false;
  Object.keys(bots).forEach((name) => {
    bots[name].running = false;
    if (bots[name].interval) clearInterval(bots[name].interval);
  });
  await ctx.reply("🛑 ĐÃ DỪNG TOÀN BỘ BOT!");
  await sendTelegram("🛑 <b>TẤT CẢ TÀI KHOẢN ĐÃ BỊ DỪNG THEO LỆNH</b>");
});

bot.command("relogin", async (ctx) => {
  await ctx.reply("🔄 Đang đăng nhập lại toàn bộ tài khoản...");
  await sendTelegram("🔄 <b>RELOGIN TOÀN BỘ TÀI KHOẢN</b>");

  isGlobalRunning = true;
  bots = {};

  ACCOUNTS.forEach((acc, i) => {
    setTimeout(() => startAccountBot(acc), i * 5000); // Cách nhau 5s để tránh flood
  });
});

// Chỉ cho phép bạn dùng bot (bảo mật)
bot.use((ctx, next) => {
  if (ctx.chat.id.toString() !== TELEGRAM_CHAT_ID) {
    return ctx.reply("Bạn không có quyền dùng bot này.");
  }
  return next();
});

// ================== KHỞI ĐỘNG ==================
console.log("🚀 Vinafull Pro Bot đang khởi động...");
sendTelegram(
  "🚀 <b>Vinafull Pro Bot đã khởi động!</b>\nSẵn sàng farm " +
    ACCOUNTS.length +
    " tài khoản"
);

bot.launch().then(() => console.log("Bot Telegram đã kết nối"));

// Khởi động tất cả tài khoản (cách nhau để tránh bị block)
ACCOUNTS.forEach((acc, index) => {
  setTimeout(() => {
    if (isGlobalRunning) startAccountBot(acc);
  }, index * 7000 + Math.random() * 5000);
});

// Xử lý tắt bot an toàn
process.on("SIGINT", () => {
  sendTelegram("Bot đã bị tắt thủ công!");
  bot.stop("SIGINT");
  process.exit();
});
