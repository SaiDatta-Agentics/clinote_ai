export type Patient = {
  id: string;
  name: string;
  initials: string;
  dateOfBirth: string;
  age: number;
  mrn: string;
  sex: string;
  phone: string;
  email: string;
  allergies: string[];
  medications: string[];
};

export type EncounterStatus = "scheduled" | "draft_ready" | "under_review" | "approved";

export type Encounter = {
  id: string;
  patientId: string;
  patientName: string;
  patientInitials: string;
  consultationType: string;
  status: EncounterStatus;
  scheduledAt: string;
  displayTime: string;
  duration: string;
  clinicianName: string;
};

export type TranscriptSegment = {
  speaker: "Clinician" | "Patient" | "Other";
  time: string;
  text: string;
  confidence: number;
};

export type ClinicalNote = {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  patientSummary: string;
  medications: string[];
  allergies: string[];
  uncertainties: Array<{
    severity: "low" | "medium" | "critical";
    text: string;
    source: string;
  }>;
};

export type AuditEvent = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
  encounterId?: string;
  tone: "blue" | "green" | "amber" | "slate";
};

export const demoPatients: Patient[] = [
  {
    id: "patient-maya-patel",
    name: "Maya Patel",
    initials: "MP",
    dateOfBirth: "14 Apr 1988",
    age: 38,
    mrn: "QLD-104829",
    sex: "Female",
    phone: "+61 4 1234 5678",
    email: "maya.patel@example.test",
    allergies: ["Penicillin — rash"],
    medications: ["Sumatriptan 50 mg PRN"],
  },
  {
    id: "patient-noah-williams",
    name: "Noah Williams",
    initials: "NW",
    dateOfBirth: "22 Sep 1971",
    age: 54,
    mrn: "QLD-101773",
    sex: "Male",
    phone: "+61 4 2456 0971",
    email: "noah.williams@example.test",
    allergies: ["No known allergies"],
    medications: ["Metformin 500 mg twice daily", "Atorvastatin 20 mg nightly"],
  },
  {
    id: "patient-olivia-chen",
    name: "Olivia Chen",
    initials: "OC",
    dateOfBirth: "03 Dec 1996",
    age: 29,
    mrn: "QLD-108421",
    sex: "Female",
    phone: "+61 4 3780 1422",
    email: "olivia.chen@example.test",
    allergies: ["Shellfish"],
    medications: ["Salbutamol inhaler PRN"],
  },
  {
    id: "patient-arjun-reddy",
    name: "Arjun Reddy",
    initials: "AR",
    dateOfBirth: "18 Feb 1983",
    age: 43,
    mrn: "QLD-112047",
    sex: "Male",
    phone: "+61 4 4102 7781",
    email: "arjun.reddy@example.test",
    allergies: ["No known allergies"],
    medications: ["Amlodipine 5 mg daily"],
  },
  {
    id: "patient-emily-thompson",
    name: "Emily Thompson",
    initials: "ET",
    dateOfBirth: "09 Jul 2001",
    age: 25,
    mrn: "QLD-113582",
    sex: "Female",
    phone: "+61 4 4201 6345",
    email: "emily.thompson@example.test",
    allergies: ["Latex"],
    medications: ["Sertraline 50 mg daily"],
  },
  {
    id: "patient-liam-oconnor",
    name: "Liam O'Connor",
    initials: "LO",
    dateOfBirth: "27 Nov 1965",
    age: 60,
    mrn: "QLD-114906",
    sex: "Male",
    phone: "+61 4 4388 2251",
    email: "liam.oconnor@example.test",
    allergies: ["Sulfonamides"],
    medications: ["Ramipril 10 mg daily", "Aspirin 100 mg daily"],
  },
  {
    id: "patient-sophia-nguyen",
    name: "Sophia Nguyen",
    initials: "SN",
    dateOfBirth: "12 Mar 1993",
    age: 33,
    mrn: "QLD-116213",
    sex: "Female",
    phone: "+61 4 4450 9912",
    email: "sophia.nguyen@example.test",
    allergies: ["No known allergies"],
    medications: ["Levothyroxine 75 mcg daily"],
  },
  {
    id: "patient-jack-wilson",
    name: "Jack Wilson",
    initials: "JW",
    dateOfBirth: "30 Jan 1978",
    age: 48,
    mrn: "QLD-118340",
    sex: "Male",
    phone: "+61 4 4511 3270",
    email: "jack.wilson@example.test",
    allergies: ["Ibuprofen — wheeze"],
    medications: ["Budesonide/formoterol inhaler"],
  },
  {
    id: "patient-ava-singh",
    name: "Ava Singh",
    initials: "AS",
    dateOfBirth: "05 May 2010",
    age: 16,
    mrn: "QLD-120771",
    sex: "Female",
    phone: "+61 4 4622 1048",
    email: "guardian.ava.singh@example.test",
    allergies: ["Peanuts"],
    medications: ["Adrenaline autoinjector PRN"],
  },
  {
    id: "patient-ethan-brown",
    name: "Ethan Brown",
    initials: "EB",
    dateOfBirth: "21 Aug 1989",
    age: 37,
    mrn: "QLD-121665",
    sex: "Male",
    phone: "+61 4 4755 4820",
    email: "ethan.brown@example.test",
    allergies: ["No known allergies"],
    medications: ["Omeprazole 20 mg daily"],
  },
  {
    id: "patient-isla-martin",
    name: "Isla Martin",
    initials: "IM",
    dateOfBirth: "16 Oct 1956",
    age: 69,
    mrn: "QLD-123004",
    sex: "Female",
    phone: "+61 4 4877 3266",
    email: "isla.martin@example.test",
    allergies: ["Codeine — nausea"],
    medications: ["Apixaban 5 mg twice daily", "Bisoprolol 2.5 mg daily"],
  },
  {
    id: "patient-lucas-garcia",
    name: "Lucas Garcia",
    initials: "LG",
    dateOfBirth: "08 Jun 1999",
    age: 27,
    mrn: "QLD-124918",
    sex: "Male",
    phone: "+61 4 4933 7185",
    email: "lucas.garcia@example.test",
    allergies: ["No known allergies"],
    medications: ["Cetirizine 10 mg PRN"],
  },
  {
    id: "patient-grace-kim",
    name: "Grace Kim",
    initials: "GK",
    dateOfBirth: "24 Apr 1985",
    age: 41,
    mrn: "QLD-126552",
    sex: "Female",
    phone: "+61 4 5032 8891",
    email: "grace.kim@example.test",
    allergies: ["Amoxicillin — hives"],
    medications: ["Metformin XR 1 g nightly"],
  },
  {
    id: "patient-henry-davis",
    name: "Henry Davis",
    initials: "HD",
    dateOfBirth: "02 Sep 1948",
    age: 77,
    mrn: "QLD-128307",
    sex: "Male",
    phone: "+61 4 5170 4412",
    email: "henry.davis@example.test",
    allergies: ["No known allergies"],
    medications: ["Tiotropium inhaler daily", "Salbutamol inhaler PRN"],
  },
  {
    id: "patient-zara-ahmed",
    name: "Zara Ahmed",
    initials: "ZA",
    dateOfBirth: "11 Dec 1991",
    age: 34,
    mrn: "QLD-130442",
    sex: "Female",
    phone: "+61 4 5294 0643",
    email: "zara.ahmed@example.test",
    allergies: ["No known allergies"],
    medications: ["Ferrous sulfate 325 mg daily"],
  },
];

export const demoEncounters: Encounter[] = [
  {
    id: "enc-maya-today",
    patientId: "patient-maya-patel",
    patientName: "Maya Patel",
    patientInitials: "MP",
    consultationType: "General consultation",
    status: "scheduled",
    scheduledAt: "2026-08-31T14:00:00.000Z",
    displayTime: "2:00 PM",
    duration: "30 min",
    clinicianName: "Doctor",
  },
  {
    id: "enc-noah-today",
    patientId: "patient-noah-williams",
    patientName: "Noah Williams",
    patientInitials: "NW",
    consultationType: "Diabetes review",
    status: "under_review",
    scheduledAt: "2026-08-31T11:15:00.000Z",
    displayTime: "11:15 AM",
    duration: "18 min",
    clinicianName: "Doctor",
  },
  {
    id: "enc-olivia-today",
    patientId: "patient-olivia-chen",
    patientName: "Olivia Chen",
    patientInitials: "OC",
    consultationType: "Respiratory follow-up",
    status: "approved",
    scheduledAt: "2026-08-31T09:30:00.000Z",
    displayTime: "9:30 AM",
    duration: "14 min",
    clinicianName: "Doctor",
  },
];

export const sampleTranscript: TranscriptSegment[] = [
  {
    speaker: "Clinician",
    time: "00:08",
    text: "Hi Maya. What would you like help with today?",
    confidence: 0.99,
  },
  {
    speaker: "Patient",
    time: "00:14",
    text: "I've been getting headaches on and off for about three weeks. They are usually over my right temple and sometimes I feel nauseous.",
    confidence: 0.98,
  },
  {
    speaker: "Clinician",
    time: "00:31",
    text: "Any vision changes, weakness, fever, recent injury, or chest pain?",
    confidence: 0.99,
  },
  {
    speaker: "Patient",
    time: "00:38",
    text: "No fever, no weakness, no injury and no chest pain. Bright light can make the headache worse. I had a little blurry vision once, but I'm not completely sure.",
    confidence: 0.96,
  },
  {
    speaker: "Clinician",
    time: "01:06",
    text: "Your blood pressure today is 128 over 82. Neurological examination is normal. There is no neck stiffness.",
    confidence: 0.99,
  },
  {
    speaker: "Patient",
    time: "01:20",
    text: "I took my sumatriptan twice this week. It helped after about an hour.",
    confidence: 0.97,
  },
  {
    speaker: "Clinician",
    time: "01:43",
    text: "This sounds consistent with your previously documented migraine pattern, but because the frequency has changed I would like a headache diary and routine blood tests. Please seek urgent care for sudden severe pain, weakness, persistent vision loss, or confusion. We'll review in two weeks.",
    confidence: 0.98,
  },
];

export const sampleNote: ClinicalNote = {
  chiefComplaint: "Intermittent right-sided headaches for three weeks.",
  subjective:
    "Patient reports intermittent headaches over the right temple for approximately three weeks, sometimes associated with nausea and photophobia. Denies fever, weakness, recent injury and chest pain. Reports one uncertain episode of mild blurred vision. Sumatriptan used twice this week with improvement after approximately one hour.",
  objective:
    "Blood pressure 128/82 mmHg. Neurological examination documented as normal. No neck stiffness documented.",
  assessment:
    "Clinician documented that symptoms are consistent with the patient's previously recorded migraine pattern, with a change in frequency requiring follow-up.",
  plan:
    "Commence headache diary. Routine blood tests discussed. Review in two weeks. Clinician provided urgent-care precautions for sudden severe headache, weakness, persistent vision loss or confusion.",
  patientSummary:
    "Track your headaches in a diary and complete the discussed blood tests. Arrange review in two weeks. Seek urgent care for sudden severe pain, weakness, persistent loss of vision or confusion.",
  medications: ["Sumatriptan — patient reports two uses this week; dose not stated in consultation"],
  allergies: ["Penicillin — rash (existing record; not discussed in consultation)"],
  uncertainties: [
    {
      severity: "medium",
      text: "Clarify the single episode of blurred vision before finalising the record.",
      source: "Patient · 00:38",
    },
    {
      severity: "low",
      text: "Sumatriptan dose was not spoken during the consultation.",
      source: "Patient · 01:20",
    },
  ],
};

export const demoAuditEvents: AuditEvent[] = [
  {
    id: "audit-1",
    action: "Note approved",
    detail: "Olivia Chen · Respiratory follow-up",
    actor: "Doctor",
    createdAt: "Today, 9:52 AM",
    encounterId: "enc-olivia-today",
    tone: "green",
  },
  {
    id: "audit-2",
    action: "Draft edited",
    detail: "Noah Williams · 3 clinician corrections saved",
    actor: "Doctor",
    createdAt: "Today, 11:41 AM",
    encounterId: "enc-noah-today",
    tone: "blue",
  },
  {
    id: "audit-3",
    action: "Audio deleted",
    detail: "Temporary recording removed after processing",
    actor: "System",
    createdAt: "Today, 11:34 AM",
    encounterId: "enc-noah-today",
    tone: "slate",
  },
  {
    id: "audit-4",
    action: "Consent captured",
    detail: "Noah Williams · Verbal consent",
    actor: "Doctor",
    createdAt: "Today, 11:16 AM",
    encounterId: "enc-noah-today",
    tone: "amber",
  },
];
