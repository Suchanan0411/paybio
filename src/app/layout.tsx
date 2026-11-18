import type { Metadata } from "next";
import { Noto_Sans_Thai, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_SCRIPT } from "@/lib/theme-script";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
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
      className={`${notoSansThai.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        {/* type เป็น text/plain ฝั่ง client เพื่อไม่ให้ React เตือนเรื่อง script; สคริปต์รันแล้วตอนโหลด HTML */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
