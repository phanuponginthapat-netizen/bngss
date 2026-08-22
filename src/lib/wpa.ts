// วPA — เก็บผลงานครู + ให้ ผอ.ประเมินออนไลน์
export async function submitWPA(personnelId: string, files: string[]){ return { id: "wpa_"+Date.now(), status:"pending" } }
