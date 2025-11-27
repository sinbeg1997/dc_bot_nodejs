const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const tough = require("tough-cookie");

// Tạo cookie jar
const cookieJar = new tough.CookieJar();

// Axios instance tự động quản lý cookie
const client = wrapper(
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

const LOGIN_URL = "https://vinafull.com/login";
const PACKET_URL = "https://vinafull.com/packet";

// Thay code của bạn vào đây
const CODE = "d9fd932e-4853-4d1a-b8f3-2c9cf71770fe";

async function login() {
  console.log("Đang đăng nhập với code:", CODE);
  try {
    const response = await client.post(
      LOGIN_URL,
      `code=${encodeURIComponent(CODE)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://vinafull.com/tool",
        },
      }
    );

    console.log("Đăng nhập thành công!\n");
    return true;
  } catch (error) {
    console.error("Đăng nhập thất bại:", error.response?.data || error.message);
    process.exit(1);
  }
}

async function doWaterfall() {
  const steps = [
    { mode: "arena-fight", name: "Đánh Arena" },
    { mode: "arena-win", name: "Nhận thắng Arena" },
    { mode: "warrior-chest", name: "Mở rương chiến binh" },
  ];

  for (const step of steps) {
    try {
      const res = await client.post(PACKET_URL, `mode=${step.mode}`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
        },
      });

      const result =
        typeof res.data === "object" ? JSON.stringify(res.data) : res.data;
      console.log(
        `[${new Date().toLocaleTimeString()}] ${step.name} → ${
          result.trim() || "OK"
        }`
      );
    } catch (error) {
      const errMsg = error.response?.data || error.message;
      console.error(
        `[${new Date().toLocaleTimeString()}] ${step.name} thất bại →`,
        errMsg
      );
    }

    // Nghỉ 1-2 giây giữa các bước để giống người thật
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function startBot() {
  await login();

  // Chạy lần đầu ngay
  console.log("Bắt đầu vòng farm đầu tiên...\n");
  await doWaterfall();

  // Sau đó lặp lại mỗi 60 giây
  setInterval(async () => {
    console.log("\n--- Bắt đầu vòng mới ---");
    await doWaterfall();
  }, 60_000);
}

// Chạy bot
startBot().catch((err) => {
  console.error("Bot lỗi nghiêm trọng:", err);
  process.exit(1);
});
