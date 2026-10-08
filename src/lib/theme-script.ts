// สคริปต์ที่รันใน <head> ก่อนวาดหน้าจอ: ใช้ธีมที่บันทึกไว้ หรือตามการตั้งค่าของเครื่อง
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

