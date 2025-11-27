// vinafull-pro-bot.js (Phiên bản cuối - Đã tối ưu thời gian farm)

const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const tough = require("tough-cookie");
const { Telegraf } = require("telegraf");

// ================== CẤU HÌNH TOÀN CỤC ==================
const CONFIG = {
  TELEGRAM_BOT_TOKEN: "8474970785:AAFKhklsNEDVwPMbT45SFJJDZcMoCgl-MfQ", // ← Thay token
  TELEGRAM_CHAT_ID: "891405971", // ← Thay chat ID của bạn

  // ⏰ THỜI GIAN FARM - CHỈ CẦN SỬA 1 DÒNG NÀY!
  FARM_INTERVAL_SECONDS: 60 * 10, // ← Thay số này để đổi thời gian lặp (ví dụ: 60, 65, 120...)

  // Tùy chọn thêm (nếu muốn random nhẹ)
  RANDOM_DELAY: true, // true = thêm 0-10s ngẫu nhiên, false = đúng bằng số trên
};

const ACCOUNTS = [
  { name: "SinhHN", code: "d9fd932e-4853-4d1a-b8f3-2c9cf71770fe" },
  { name: "bean02", code: "7443247a-4bb0-4aa3-94a5-98b712597004" },
  { name: "dogfish65", code: "ac88872c-db4f-480b-bb04-54ba159fd400" },
  { name: "thedeepcat", code: "6a10e57f-9114-4269-8e60-edabda464c9e" },
];

const LOGIN_URL = "https://vinafull.com/login";
const PACKET_URL = "https://vinafull.com/packet";

const WATERFALL_STEPS = [
  { mode: "arena-fight", name: "Đánh Arena" },
  { mode: "arena-win", name: "Nhận thắng Arena" },
  { mode: "warrior-chest", name: "Mở rương chiến binh" },
];

// ================== TÍNH TOÁN THỜI GIAN ==================
function getFarmIntervalMs() {
  let base = CONFIG.FARM_INTERVAL_SECONDS * 1000;
  if (CONFIG.RANDOM_DELAY) {
    base += Math.random() * 10000; // +0 đến +10 giây
  }
  return Math.floor(base);
}

// ================== BIẾN TOÀN CỤC ==================
const bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);
let bots = {}; // { accountName: { client, interval, running: true } }
let isGlobalRunning = true;

// ================== HỖ TRỢ ==================
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const timeNow = () => new Date().toLocaleTimeString("vi-VN", { hour12: false });

async function sendTelegram(msg) {
  try {
    await bot.telegram.sendMessage(CONFIG.TELEGRAM_CHAT_ID, msg, {
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
        output.toLowerCase().includes("thành công") || output === "OK"
          ? "✅"
          : "⚠️";
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

  await doWaterfall(client, account);

  const intervalMs = getFarmIntervalMs();
  const interval = setInterval(async () => {
    if (isGlobalRunning && bots[account.name]?.running) {
      const nextIn = Math.round(intervalMs / 1000);
      await sendTelegram(
        `\n🔄 <b>${account.name}</b> — Vòng farm mới (mỗi ~${nextIn}s) —`
      );
      await doWaterfall(client, account);
    }
  }, intervalMs);

  bots[account.name] = { client, interval, running: true };
  console.log(
    `[${timeNow()}] ✅ [${account.name}] Bot khởi động - Chu kỳ: ~${Math.round(
      intervalMs / 1000
    )}s`
  );
}

// ================== LỆNH TELEGRAM ==================
bot.start((ctx) =>
  ctx.reply(
    `🚀 Vinafull Pro Bot v2\nChu kỳ farm: ${CONFIG.FARM_INTERVAL_SECONDS}s ${
      CONFIG.RANDOM_DELAY ? "+ random" : ""
    }\nDùng /status /stop /relogin`
  )
);

bot.command("status", async (ctx) => {
  const running = Object.keys(bots).filter((n) => bots[n]?.running).length;
  const cycle = CONFIG.RANDOM_DELAY
    ? `${CONFIG.FARM_INTERVAL_SECONDS}-${CONFIG.FARM_INTERVAL_SECONDS + 10}s`
    : `${CONFIG.FARM_INTERVAL_SECONDS}s`;

  await ctx.reply(
    `📊 Trạng thái: ${
      isGlobalRunning ? "🟢 ĐANG CHẠY" : "🔴 ĐÃ DỪNG"
    }\n⏰ Chu kỳ: ${cycle}\n👥 Đang farm: ${running}/${
      ACCOUNTS.length
    } tài khoản`
  );
});

bot.command("stop", async (ctx) => {
  isGlobalRunning = false;
  Object.keys(bots).forEach((name) => {
    bots[name].running = false;
    clearInterval(bots[name].interval);
  });
  await ctx.reply("🛑 ĐÃ DỪNG TOÀN BỘ BOT!");
  await sendTelegram("🛑 <b>TẤT CẢ TÀI KHOẢN ĐÃ BỊ DỪNG</b>");
});

bot.command("relogin", async (ctx) => {
  await ctx.reply("🔄 Đang đăng nhập lại toàn bộ...");
  await sendTelegram(
    `🔄 <b>RELOGIN TOÀN BỘ - Chu kỳ mới: ~${CONFIG.FARM_INTERVAL_SECONDS}s</b>`
  );

  isGlobalRunning = true;
  bots = {};

  ACCOUNTS.forEach((acc, i) => {
    setTimeout(() => startAccountBot(acc), i * 5000);
  });
});

// Bảo mật: chỉ chủ sở hữu dùng được
bot.use((ctx, next) => {
  if (String(ctx.chat?.id) !== CONFIG.TELEGRAM_CHAT_ID) {
    return ctx.reply("🚫 Không có quyền truy cập.");
  }
  return next();
});

// ================== KHỞI ĐỘNG ==================
console.log("🚀 Khởi động Vinafull Pro Bot...");
sendTelegram(
  `🚀 <b>Bot đã khởi động!</b>\n👥 ${ACCOUNTS.length} tài khoản\n⏰ Chu kỳ: ~${
    CONFIG.FARM_INTERVAL_SECONDS
  }s ${CONFIG.RANDOM_DELAY ? "+ random" : ""}`
);

bot.launch();
console.log("Telegram Bot đã kết nối");

// Khởi động từng acc
ACCOUNTS.forEach((acc, i) => {
  setTimeout(() => {
    if (isGlobalRunning) startAccountBot(acc);
  }, i * 7000 + Math.random() * 3000);
});

process.on("SIGINT", () => {
  sendTelegram("Bot đã bị tắt!");
  bot.stop();
  process.exit();
});
