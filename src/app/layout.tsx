import type { Metadata } from "next";
import { Anuphan, Noto_Sans_Thai, Geist_Mono, Poppins, Prompt } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_SCRIPT } from "@/lib/theme-script";

// ฟอนต์เนื้อหา: Anuphan อ่านสบายตา / หัวข้อ: Prompt มนและทันสมัย
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["500", "600"],
});

// ร้านที่เลือกฟอนต์ Noto Sans Thai ในธีมหน้าร้าน
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  preload: false,
});

// ฟอนต์ตัวอักษรโลโก้ PayBio
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: "700",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PayBio — เปิดร้านใน Bio รับเงินพร้อมเพย์",
  description: "สร้างหน้าร้านออนไลน์ รับชำระเงินผ่าน QR พร้อมเพย์ และตรวจสลิปได้ในที่เดียว",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      data-theme="dark"
      suppressHydrationWarning
      className={`${anuphan.variable} ${prompt.variable} ${notoSansThai.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        {/* type เป็น text/plain ฝั่ง client เพื่อไม่ให้ React เตือนเรื่อง script; สคริปต์รันแล้วตอนโหลด HTML */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
