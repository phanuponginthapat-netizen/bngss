import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
// registry.ts is created when transactional email infra is scaffolded — optional import

interface Props {
  name?: string
  dateLabel?: string
  items?: string[]
}

const Email = ({ name, dateLabel, items = [] }: Props) => (
  <Html lang="th" dir="ltr">
    <Head />
    <Preview>ตารางเวร{dateLabel ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>แจ้งเตือนครูเวรประจำวัน</Heading>
        <Text style={text}>เรียน คุณครู {name ?? ''}</Text>
        <Text style={text}>รายการเวร{dateLabel ?? ''}:</Text>
        <Section style={box}>
          {items.map((line, i) => (
            <Text key={i} style={item}>{line}</Text>
          ))}
        </Section>
        <Text style={muted}>โปรดเข้าปฏิบัติหน้าที่ตามเวลาที่กำหนด · ขอบคุณครับ/ค่ะ</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'แจ้งเตือนครูเวรประจำวัน',
  displayName: 'Duty Schedule Notice',
  previewData: { name: 'สมชาย', dateLabel: 'พรุ่งนี้ (จันทร์ 2026-01-01)', items: ['• หน้าประตู 07:00–08:00', '• โรงอาหาร 11:30–12:30'] },
} as const

const main = { backgroundColor: '#ffffff', fontFamily: 'Sarabun, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { color: '#0f172a', fontSize: '20px', margin: '0 0 12px' }
const text = { color: '#334155', fontSize: '14px', lineHeight: '22px', margin: '6px 0' }
const box = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', margin: '12px 0' }
const item = { color: '#0f172a', fontSize: '14px', margin: '4px 0' }
const muted = { color: '#64748b', fontSize: '12px', marginTop: '16px' }
