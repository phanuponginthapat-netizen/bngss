import { useCmsSettingsBulk } from "./useCmsSettings";

export interface DmcFieldConfig {
  // Personal
  national_id: boolean;
  date_of_birth: boolean;
  gender: boolean;
  nationality: boolean;
  ethnicity: boolean;
  religion: boolean;
  blood_type: boolean;
  birth_province: boolean;
  address: boolean;
  phone: boolean;
  photo_url: boolean;
  weight: boolean;
  height: boolean;
  special_needs: boolean;
  // Education
  previous_school: boolean;
  admission_date: boolean;
  // Parents
  father_name: boolean;
  father_id: boolean;
  father_phone: boolean;
  father_occupation: boolean;
  mother_name: boolean;
  mother_id: boolean;
  mother_phone: boolean;
  mother_occupation: boolean;
  guardian_name: boolean;
  guardian_phone: boolean;
  guardian_relation: boolean;
  // Emergency
  emergency_contact: boolean;
  emergency_phone: boolean;
}

export const DEFAULT_FIELD_VISIBILITY: DmcFieldConfig = {
  national_id: true,
  date_of_birth: true,
  gender: true,
  nationality: true,
  ethnicity: true,
  religion: true,
  blood_type: true,
  birth_province: true,
  address: true,
  phone: true,
  photo_url: true,
  weight: true,
  height: true,
  special_needs: true,
  previous_school: true,
  admission_date: true,
  father_name: true,
  father_id: true,
  father_phone: true,
  father_occupation: true,
  mother_name: true,
  mother_id: true,
  mother_phone: true,
  mother_occupation: true,
  guardian_name: true,
  guardian_phone: true,
  guardian_relation: true,
  emergency_contact: true,
  emergency_phone: true,
};

export const FIELD_LABELS: Record<keyof DmcFieldConfig, string> = {
  national_id: "เลขประจำตัวประชาชน",
  date_of_birth: "วันเกิด",
  gender: "เพศ",
  nationality: "สัญชาติ",
  ethnicity: "เชื้อชาติ",
  religion: "ศาสนา",
  blood_type: "หมู่เลือด",
  birth_province: "จังหวัดเกิด",
  address: "ที่อยู่",
  phone: "เบอร์โทร",
  photo_url: "รูปภาพ",
  weight: "น้ำหนัก (กก.)",
  height: "ส่วนสูง (ซม.)",
  special_needs: "ความต้องการพิเศษ",
  previous_school: "โรงเรียนเดิม",
  admission_date: "วันที่เข้าเรียน",
  father_name: "ชื่อบิดา",
  father_id: "เลขบัตรบิดา",
  father_phone: "โทรบิดา",
  father_occupation: "อาชีพบิดา",
  mother_name: "ชื่อมารดา",
  mother_id: "เลขบัตรมารดา",
  mother_phone: "โทรมารดา",
  mother_occupation: "อาชีพมารดา",
  guardian_name: "ชื่อผู้ปกครอง",
  guardian_phone: "โทรผู้ปกครอง",
  guardian_relation: "ความสัมพันธ์กับผู้ปกครอง",
  emergency_contact: "ผู้ติดต่อฉุกเฉิน",
  emergency_phone: "เบอร์ฉุกเฉิน",
};

export const FIELD_GROUPS: { label: string; fields: (keyof DmcFieldConfig)[] }[] = [
  {
    label: "ข้อมูลส่วนตัว",
    fields: ["national_id", "date_of_birth", "gender", "nationality", "ethnicity", "religion", "blood_type", "birth_province", "address", "phone", "photo_url", "weight", "height", "special_needs"],
  },
  {
    label: "ข้อมูลการศึกษา",
    fields: ["previous_school", "admission_date"],
  },
  {
    label: "ข้อมูลบิดา",
    fields: ["father_name", "father_id", "father_phone", "father_occupation"],
  },
  {
    label: "ข้อมูลมารดา",
    fields: ["mother_name", "mother_id", "mother_phone", "mother_occupation"],
  },
  {
    label: "ข้อมูลผู้ปกครอง",
    fields: ["guardian_name", "guardian_phone", "guardian_relation"],
  },
  {
    label: "ข้อมูลฉุกเฉิน",
    fields: ["emergency_contact", "emergency_phone"],
  },
];

export function useFieldVisibility() {
  const { data: bulk, isLoading } = useCmsSettingsBulk();
  let config: DmcFieldConfig = DEFAULT_FIELD_VISIBILITY;
  const raw = bulk?.["dmc_field_visibility"];
  if (raw) {
    try {
      config = { ...DEFAULT_FIELD_VISIBILITY, ...JSON.parse(raw) } as DmcFieldConfig;
    } catch {
      /* ignore */
    }
  }
  return { config, isLoading };
}
