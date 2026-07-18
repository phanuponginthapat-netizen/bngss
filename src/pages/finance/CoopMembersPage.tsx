import { SimpleCrudPage, statusBadge, moneyTH } from "@/components/generic/SimpleCrudPage";
import { Coins } from "lucide-react";

export default function CoopMembersPage() {
  return (
    <SimpleCrudPage
      title="สมาชิกสหกรณ์โรงเรียน"
      subtitle="ทะเบียนสมาชิก จำนวนหุ้น และยอดเงินคงเหลือ"
      icon={Coins}
      table="coop_members"
      searchableFields={["member_no", "full_name"]}
      fields={[
        { name: "member_no", label: "เลขสมาชิก", required: true, placeholder: "C-0001" },
        { name: "full_name", label: "ชื่อ-สกุล", required: true },
        { name: "shares", label: "จำนวนหุ้น", type: "number", defaultValue: 0 },
        { name: "balance", label: "ยอดคงเหลือ (บาท)", type: "number", defaultValue: 0 },
        { name: "loan_balance", label: "ยอดเงินกู้คงค้าง (บาท)", type: "number", defaultValue: 0 },
        { name: "joined_at", label: "วันที่สมัคร", type: "date" },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "active",
          options: [
            { value: "active", label: "ใช้งาน" },
            { value: "suspended", label: "พักสมาชิก" },
            { value: "resigned", label: "ลาออก" },
          ]},
      ]}
      columns={[
        { key: "member_no", label: "เลขสมาชิก" },
        { key: "full_name", label: "ชื่อ-สกุล" },
        { key: "shares", label: "หุ้น" },
        { key: "balance", label: "ยอดเงิน", render: v => moneyTH(v) },
        { key: "loan_balance", label: "เงินกู้", render: v => moneyTH(v) },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          active: { label: "ใช้งาน", variant: "default" },
          suspended: { label: "พัก", variant: "secondary" },
          resigned: { label: "ลาออก", variant: "outline" },
        })},
      ]}
    />
  );
}
