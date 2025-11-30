// vinafull-pro-bot.js (Phiên bản cuối - Đầy đủ tính năng)

const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const tough = require("tough-cookie");
const { Telegraf } = require("telegraf");

// ================== CẤU HÌNH TOÀN CỤC ==================
const CONFIG = {
  TELEGRAM_BOT_TOKEN: "8474970785:AAFKhklsNEDVwPMbT45SFJJDZcMoCgl-MfQ", // ← Thay token
  TELEGRAM_CHAT_ID: "891405971", // ← Thay chat ID của bạn

  // ⏰ THỜI GIAN FARM CHÍNH (WATERFALL)
  FARM_INTERVAL_SECONDS: 60 * 10, // ← Thay số này để đổi thời gian lặp (ví dụ: 60, 65, 120...)

  // ⏰ THỜI GIAN CÁC TÍNH NĂNG TỰ ĐỘNG
  WATCH_TV_INTERVAL_MINUTES: 65, // Xem TV mỗi 65 phút
  FREE_FOOD_INTERVAL_MINUTES: 730, // Free food mỗi 730 phút (12+ giờ)

  // Tùy chọn thêm
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
const REFRESH_INFO_URL = "https://vinafull.com/refresh-info"; // ← API mới

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

function getWatchTvIntervalMs() {
  let base = CONFIG.WATCH_TV_INTERVAL_MINUTES * 60 * 1000;
  if (CONFIG.RANDOM_DELAY) {
    base += Math.random() * 60000; // +0 đến +60s
  }
  return Math.floor(base);
}

function getFreeFoodIntervalMs() {
  let base = CONFIG.FREE_FOOD_INTERVAL_MINUTES * 60 * 1000;
  if (CONFIG.RANDOM_DELAY) {
    base += Math.random() * 120000; // +0 đến +2 phút
  }
  return Math.floor(base);
}

// ================== BIẾN TOÀN CỤC ==================
const bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);
let bots = {}; // { accountName: { client, interval, running: true, watchTvInterval, freeFoodInterval } }
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

// ================== API CALLS ==================
// 📺 WATCH TV
async function doWatchTv(client, account) {
  if (!isGlobalRunning || !bots[account.name]?.running) return;

  try {
    const res = await client.post(PACKET_URL, `mode=watch-tv`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result =
      typeof res.data === "object"
        ? JSON.stringify(res.data)
        : (res.data || "").trim();
    const output = result || "OK";

    const icon =
      output.toLowerCase().includes("thành công") || output === "OK"
        ? "📺✅"
        : "📺⚠️";
    await sendTelegram(
      `${icon} <b>${account.name}</b> → Xem TV\n<code>${output}</code>`
    );
  } catch (err) {
    const msg = err.response?.data || err.message;
    await sendTelegram(
      `📺❌ <b>${account.name}</b> → Xem TV thất bại\n<code>${msg}</code>`
    );
  }
}

// 🍖 FREE FOOD (1 lần - cho command)
async function doFreeFood100k(client, account) {
  if (!isGlobalRunning || !bots[account.name]?.running) return;

  try {
    const res = await client.post(PACKET_URL, `mode=free-food-100k`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result =
      typeof res.data === "object"
        ? JSON.stringify(res.data)
        : (res.data || "").trim();
    const output = result || "OK";

    const icon =
      output.toLowerCase().includes("thành công") || output === "OK"
        ? "🍖✅"
        : "🍖⚠️";
    await sendTelegram(
      `${icon} <b>${account.name}</b> → Free Food 100k\n<code>${output}</code>`
    );
  } catch (err) {
    const msg = err.response?.data || err.message;
    await sendTelegram(
      `🍖❌ <b>${account.name}</b> → Free Food 100k thất bại\n<code>${msg}</code>`
    );
  }
}

// 🍖 FREE FOOD WATERFALL (5 lần - tự động)
async function doFreeFoodWaterfall(client, account) {
  if (!isGlobalRunning || !bots[account.name]?.running) return;

  for (let i = 0; i < 5; i++) {
    try {
      const res = await client.post(PACKET_URL, `mode=free-food-100k`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const result =
        typeof res.data === "object"
          ? JSON.stringify(res.data)
          : (res.data || "").trim();
      const output = result || "OK";

      const icon =
        output.toLowerCase().includes("thành công") || output === "OK"
          ? "🍖✅"
          : "🍖⚠️";
      await sendTelegram(
        `${icon} <b>${account.name}</b> → Free Food ${
          i + 1
        }/5\n<code>${output}</code>`
      );
    } catch (err) {
      const msg = err.response?.data || err.message;
      await sendTelegram(
        `🍖❌ <b>${account.name}</b> → Free Food ${
          i + 1
        }/5 thất bại\n<code>${msg}</code>`
      );
    }
    if (i < 4) await delay(1500 + Math.random() * 1000); // Delay giữa các lần
  }
}

// 🥩 COLLECT FOOD (Command)
async function doCollectFood(client, account) {
  try {
    const res = await client.post(PACKET_URL, `mode=collect-food`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result =
      typeof res.data === "object"
        ? JSON.stringify(res.data)
        : (res.data || "").trim();
    const output = result || "OK";

    const icon =
      output.toLowerCase().includes("thành công") || output === "OK"
        ? "🥩✅"
        : "🥩⚠️";
    await sendTelegram(
      `${icon} <b>${account.name}</b> → Thu hoạch thức ăn\n<code>${output}</code>`
    );
  } catch (err) {
    const msg = err.response?.data || err.message;
    await sendTelegram(
      `🥩❌ <b>${account.name}</b> → Thu hoạch thức ăn thất bại\n<code>${msg}</code>`
    );
  }
}

// ================== HÀM FORMAT SỐ ĐẸP ==================
function formatNumber(num) {
  if (num === null || num === undefined || num === "N/A") return "N/A";
  return Number(num).toLocaleString("en-US");
}
// 📊 REFRESH INFO (GET /refresh-info)
async function doRefreshInfo(client, account) {
  if (!isGlobalRunning || !bots[account.name]?.running) return;

  try {
    const res = await client.get(REFRESH_INFO_URL);
    const info = res.data;

    // Format thông tin với SỐ ĐẸP
    let infoMsg = `<b>${account.name}</b> → <b>Thông tin tài khoản</b>\n`;
    infoMsg += `👑 <b>Level:</b> ${formatNumber(info.level?.current)}\n`;
    infoMsg += `💎 <b>Gems:</b> ${formatNumber(info.cash?.current)}\n`;
    infoMsg += `🪙 <b>Gold:</b> ${formatNumber(info.gold?.current)}\n`;
    infoMsg += `🥩 <b>Food:</b> ${formatNumber(info.food?.current)}\n`;
    infoMsg += `⚡ <b>Stamina:</b> ${formatNumber(info.stamina?.current)}\n`;

    await sendTelegram(`✅ ${infoMsg}`);
  } catch (err) {
    const msg = err.response?.data || err.message;
    await sendTelegram(
      `📊❌ <b>${account.name}</b> → Lấy thông tin thất bại\n<code>${msg}</code>`
    );
  }
}

// ================== ĐĂNG NHẬP & FARM CHÍNH ==================
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
    clearInterval(bots[account.name].watchTvInterval);
    clearInterval(bots[account.name].freeFoodInterval);
  }

  const client = createClient();
  const loggedIn = await login(client, account);
  if (!loggedIn) {
    bots[account.name] = { running: false };
    return;
  }

  await doWaterfall(client, account);

  // 🔥 FARM CHÍNH
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

  // 📺 WATCH TV INTERVAL
  const watchTvIntervalMs = getWatchTvIntervalMs();
  const watchTvInterval = setInterval(async () => {
    if (isGlobalRunning && bots[account.name]?.running) {
      await doWatchTv(client, account);
    }
  }, watchTvIntervalMs);

  // 🍖 FREE FOOD INTERVAL
  const freeFoodIntervalMs = getFreeFoodIntervalMs();
  const freeFoodInterval = setInterval(async () => {
    if (isGlobalRunning && bots[account.name]?.running) {
      await sendTelegram(
        `🍖 <b>${account.name}</b> — Bắt đầu Free Food Waterfall (5 lần) —`
      );
      await doFreeFoodWaterfall(client, account);
    }
  }, freeFoodIntervalMs);

  bots[account.name] = {
    client,
    interval,
    watchTvInterval,
    freeFoodInterval,
    running: true,
  };
  console.log(
    `[${timeNow()}] ✅ [${account.name}] Bot khởi động - Farm: ~${Math.round(
      intervalMs / 1000
    )}s | TV: ~${Math.round(watchTvIntervalMs / 60000)}m | Food: ~${Math.round(
      freeFoodIntervalMs / 60000
    )}m`
  );
}

// ================== LỆNH TELEGRAM ==================
bot.start((ctx) =>
  ctx.reply(
    `🚀 <b>DC Bot v4 - FULL COMMANDS</b>\n` +
      `🔄 Farm chính: ${CONFIG.FARM_INTERVAL_SECONDS}s\n` +
      `📺 Watch TV: ${CONFIG.WATCH_TV_INTERVAL_MINUTES}m\n` +
      `🍖 Free Food: ${CONFIG.FREE_FOOD_INTERVAL_MINUTES}m (5 lần)\n\n` +
      `📋 <b>LỆNH CHÍNH:</b>\n` +
      `/status - Xem trạng thái\n` +
      `/stop - Dừng tất cả\n` +
      `/relogin - Đăng nhập lại\n\n` +
      `🍖 <b>LỆNH FOOD:</b>\n` +
      `/collectfood - Thu hoạch thức ăn\n` +
      `/freefood100k - Free food 100k (1 lần)\n\n` +
      `📺 <b>LỆNH TV:</b>\n` +
      `/watchtv - Xem TV ngay\n\n` +
      `📊 <b>LỆNH INFO:</b>\n` +
      `/refreshinfo - Lấy thông tin tài khoản`
  )
);

bot.command("status", async (ctx) => {
  const running = Object.keys(bots).filter((n) => bots[n]?.running).length;
  const cycle = CONFIG.RANDOM_DELAY
    ? `${CONFIG.FARM_INTERVAL_SECONDS}-${CONFIG.FARM_INTERVAL_SECONDS + 10}s`
    : `${CONFIG.FARM_INTERVAL_SECONDS}s`;

  let statusMsg = `📊 <b>TRẠNG THÁI BOT v4</b>\n`;
  statusMsg += `🚦 Tình trạng: ${
    isGlobalRunning ? "🟢 ĐANG CHẠY" : "🔴 ĐÃ DỪNG"
  }\n`;
  statusMsg += `⏰ Farm chính: ${cycle}\n`;
  statusMsg += `📺 Watch TV: ${CONFIG.WATCH_TV_INTERVAL_MINUTES} phút\n`;
  statusMsg += `🍖 Free Food: ${CONFIG.FREE_FOOD_INTERVAL_MINUTES} phút\n`;
  statusMsg += `👥 Đang farm: ${running}/${ACCOUNTS.length} tài khoản`;

  await ctx.reply(statusMsg);
});

// 🔥 COMMAND MỚI 1: /freefood100k
bot.command("freefood100k", async (ctx) => {
  await ctx.reply("🍖 <b>Đang Free Food 100k cho TẤT CẢ tài khoản...</b>");
  await sendTelegram("🍖 <b>COMMAND: FREE FOOD 100K (1 LẦN)</b>");

  const promises = ACCOUNTS.map(async (account) => {
    if (bots[account.name]?.client && bots[account.name]?.running) {
      await doFreeFood100k(bots[account.name].client, account);
      await delay(2000); // Delay giữa các tài khoản
    }
  });

  await Promise.all(promises);
  await ctx.reply("✅ <b>Hoàn thành Free Food 100k!</b>");
});

// 🔥 COMMAND MỚI 2: /watchtv
bot.command("watchtv", async (ctx) => {
  await ctx.reply("📺 <b>Đang xem TV cho TẤT CẢ tài khoản...</b>");
  await sendTelegram("📺 <b>COMMAND: WATCH TV NGAY</b>");

  const promises = ACCOUNTS.map(async (account) => {
    if (bots[account.name]?.client && bots[account.name]?.running) {
      await doWatchTv(bots[account.name].client, account);
      await delay(2000); // Delay giữa các tài khoản
    }
  });

  await Promise.all(promises);
  await ctx.reply("✅ <b>Hoàn thành xem TV!</b>");
});

// 🔥 COMMAND MỚI 3: /refreshinfo
bot.command("refreshinfo", async (ctx) => {
  await ctx.reply("📊 <b>Đang lấy thông tin tài khoản cho TẤT CẢ...</b>");
  await sendTelegram("📊 <b>COMMAND: REFRESH INFO TOÀN BỘ</b>");

  const promises = ACCOUNTS.map(async (account) => {
    if (bots[account.name]?.client && bots[account.name]?.running) {
      await doRefreshInfo(bots[account.name].client, account);
      await delay(1500); // Delay giữa các tài khoản
    }
  });

  await Promise.all(promises);
  await ctx.reply("✅ <b>Hoàn thành lấy thông tin!</b>");
});

// Các command cũ
bot.command("collectfood", async (ctx) => {
  await ctx.reply("🥩 <b>Đang thu hoạch thức ăn cho TẤT CẢ tài khoản...</b>");
  await sendTelegram("🥩 <b>COMMAND: THU HOẠCH THỨC ĂN</b>");

  const promises = ACCOUNTS.map(async (account) => {
    if (bots[account.name]?.client && bots[account.name]?.running) {
      await doCollectFood(bots[account.name].client, account);
      await delay(2000);
    }
  });

  await Promise.all(promises);
  await ctx.reply("✅ <b>Hoàn thành thu hoạch thức ăn!</b>");
});

bot.command("stop", async (ctx) => {
  isGlobalRunning = false;
  Object.keys(bots).forEach((name) => {
    bots[name].running = false;
    clearInterval(bots[name].interval);
    clearInterval(bots[name].watchTvInterval);
    clearInterval(bots[name].freeFoodInterval);
  });
  await ctx.reply("🛑 ĐÃ DỪNG TOÀN BỘ BOT!");
  await sendTelegram("🛑 <b>TẤT CẢ TÀI KHOẢN ĐÃ BỊ DỪNG</b>");
});

bot.command("relogin", async (ctx) => {
  await ctx.reply("🔄 Đang đăng nhập lại toàn bộ...");
  await sendTelegram(
    `🔄 <b>RELOGIN TOÀN BỘ</b>\n` +
      `⏰ Farm: ~${CONFIG.FARM_INTERVAL_SECONDS}s | 📺 TV: ${CONFIG.WATCH_TV_INTERVAL_MINUTES}m | 🍖 Food: ${CONFIG.FREE_FOOD_INTERVAL_MINUTES}m`
  );

  isGlobalRunning = true;
  bots = {};

  ACCOUNTS.forEach((acc, i) => {
    setTimeout(() => startAccountBot(acc), i * 5000);
  });
});

// Bảo mật
bot.use((ctx, next) => {
  if (String(ctx.chat?.id) !== CONFIG.TELEGRAM_CHAT_ID) {
    return ctx.reply("🚫 <b>Không có quyền truy cập.</b>");
  }
  return next();
});

// ================== LỆNH MỚI BẠN YÊU CẦU ==================

// 1. /arena – Đánh Arena 6 lần liên tiếp (theo WATERFALL_STEPS)
bot.command("arena", async (ctx) => {
  await ctx.reply(
    "⚔️ <b>Đang thực hiện Arena 6 lần cho tất cả tài khoản...</b>"
  );
  await sendTelegram("⚔️ <b>COMMAND: ARENA 6 LẦN</b>");

  const promises = ACCOUNTS.map(async (account) => {
    const botData = bots[account.name];
    if (!botData?.client || !botData.running) return;

    for (let round = 1; round <= 6; round++) {
      if (!isGlobalRunning || !bots[account.name]?.running) break;

      await sendTelegram(`⚔️ <b>${account.name}</b> → Vòng Arena ${round}/6`);

      for (const step of WATERFALL_STEPS) {
        try {
          const res = await botData.client.post(
            PACKET_URL,
            `mode=${step.mode}`,
            {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
          );
          const result =
            typeof res.data === "object"
              ? JSON.stringify(res.data)
              : (res.data || "").trim();
          const icon =
            result.toLowerCase().includes("thành công") || result === "OK"
              ? "✅"
              : "⚠️";
          await sendTelegram(
            `${icon} <b>${account.name}</b> → ${step.name} (lần ${round})\n<code>${result}</code>`
          );
        } catch (err) {
          const msg = err.response?.data || err.message;
          await sendTelegram(
            `❌ <b>${account.name}</b> → ${step.name} thất bại (lần ${round})\n<code>${msg}</code>`
          );
        }
        await delay(1200 + Math.random() * 1800);
      }
      if (round < 6) await delay(3000); // Nghỉ giữa các vòng arena
    }
  });

  await Promise.all(promises);
  await ctx.reply("✅ <b>Hoàn thành Arena 6 lần cho tất cả tài khoản!</b>");
});

// 2. /greenhouse – Gọi mode=greenhouse 1 lần mỗi tài khoản
bot.command("greenhouse", async (ctx) => {
  await ctx.reply(
    "🌱 <b>Đang thực hiện Greenhouse cho tất cả tài khoản...</b>"
  );
  await sendTelegram("🌱 <b>COMMAND: GREENHOUSE</b>");

  const promises = ACCOUNTS.map(async (account) => {
    const botData = bots[account.name];
    if (!botData?.client || !botData.running) return;

    try {
      const res = await botData.client.post(PACKET_URL, `mode=greenhouse`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const result =
        typeof res.data === "object"
          ? JSON.stringify(res.data)
          : (res.data || "").trim();
      const icon =
        result.toLowerCase().includes("thành công") || result === "OK"
          ? "🌱✅"
          : "🌱⚠️";
      await sendTelegram(
        `${icon} <b>${account.name}</b> → Greenhouse\n<code>${result}</code>`
      );
    } catch (err) {
      const msg = err.response?.data || err.message;
      await sendTelegram(
        `🌱❌ <b>${account.name}</b> → Greenhouse thất bại\n<code>${msg}</code>`
      );
    }
    await delay(2000);
  });

  await Promise.all(promises);
  await ctx.reply("✅ <b>Hoàn thành Greenhouse!</b>");
});

// 3. /help – Liệt kê đầy đủ tất cả lệnh hiện có (cập nhật mới nhất)
bot.command("help", async (ctx) => {
  const helpMsg = `
<b>📋 DANH SÁCH LỆNH BOT v4 (CẬP NHẬT MỚI NHẤT)</b>

<b>╭─ Lệnh chính</b>
├ /start – Xem thông tin bot
├ /status – Xem trạng thái hiện tại
├ /stop – Dừng toàn bộ bot
├ /relogin – Đăng nhập lại tất cả

<b>╭─ Lệnh hành động ngay</b>
├ /arena – Đánh Arena 6 lần liên tiếp
├ /greenhouse – Thu hoạch nhà kính (1 lần)
├ /watchtv – Xem TV ngay
├ /freefood100k – Free Food 100k (1 lần)
├ /collectfood – Thu hoạch thức ăn

<b>╭─ Lệnh thông tin</b>
├ /refreshinfo – Cập nhật thông tin tài khoản
└ /help – Xem danh sách lệnh này

<b>⏰ Tự động:</b>
├ Farm chính: ~${CONFIG.FARM_INTERVAL_SECONDS}s
├ Watch TV: ${CONFIG.WATCH_TV_INTERVAL_MINUTES} phút
└ Free Food (5 lần): ${CONFIG.FREE_FOOD_INTERVAL_MINUTES} phút
  `.trim();

  await ctx.reply(helpMsg, { parse_mode: "HTML" });
});

// ================== KHỞI ĐỘNG ==================
console.log("🚀 Khởi động DC Bot v4 - FULL COMMANDS...");
sendTelegram(
  `🚀 <b>Bot v4 FULL COMMANDS đã khởi động!</b>\n` +
    `👥 ${ACCOUNTS.length} tài khoản\n` +
    `🔄 Farm: ~${CONFIG.FARM_INTERVAL_SECONDS}s\n` +
    `📺 Watch TV: ${CONFIG.WATCH_TV_INTERVAL_MINUTES} phút\n` +
    `🍖 Free Food: ${CONFIG.FREE_FOOD_INTERVAL_MINUTES} phút (5 lần)\n` +
    `📋 Commands: /freefood100k /watchtv /refreshinfo /collectfood`
);

bot.launch();
console.log("✅ Telegram Bot đã kết nối");

// Khởi động từng acc
ACCOUNTS.forEach((acc, i) => {
  setTimeout(() => {
    if (isGlobalRunning) startAccountBot(acc);
  }, i * 7000 + Math.random() * 3000);
});

process.on("SIGINT", () => {
  sendTelegram("💤 <b>Bot đã bị tắt!</b>");
  bot.stop();
  process.exit();
});
