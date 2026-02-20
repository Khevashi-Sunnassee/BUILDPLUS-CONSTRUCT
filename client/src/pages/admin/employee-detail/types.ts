import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import type { Employee, EmployeeEmployment, EmployeeDocument, EmployeeLicence, Department } from "@shared/schema";

export const CONSTRUCTION_TICKET_TYPES = [
  { value: "Forklift Licence", category: "Plant & Equipment" },
  { value: "Elevated Work Platform (EWP)", category: "Plant & Equipment" },
  { value: "Boom-Type EWP (Over 11m)", category: "Plant & Equipment" },
  { value: "Crane Operator (up to 20t)", category: "Plant & Equipment" },
  { value: "Crane Operator (up to 60t)", category: "Plant & Equipment" },
  { value: "Crane Operator (up to 100t)", category: "Plant & Equipment" },
  { value: "Crane Operator (over 100t)", category: "Plant & Equipment" },
  { value: "Dogging", category: "Rigging & Lifting" },
  { value: "Basic Rigging", category: "Rigging & Lifting" },
  { value: "Intermediate Rigging", category: "Rigging & Lifting" },
  { value: "Advanced Rigging", category: "Rigging & Lifting" },
  { value: "Basic Scaffolding", category: "Rigging & Lifting" },
  { value: "Intermediate Scaffolding", category: "Rigging & Lifting" },
  { value: "Advanced Scaffolding", category: "Rigging & Lifting" },
  { value: "Concrete Placing Boom", category: "Plant & Equipment" },
  { value: "Reach Stacker", category: "Plant & Equipment" },
  { value: "Bridge & Gantry Crane", category: "Plant & Equipment" },
  { value: "Vehicle Loading Crane", category: "Plant & Equipment" },
  { value: "Hoist (Personnel & Materials)", category: "Plant & Equipment" },
  { value: "Hoist (Materials Only)", category: "Plant & Equipment" },
  { value: "Pressure Equipment", category: "Plant & Equipment" },
  { value: "White Card (General Construction Induction)", category: "Safety & Induction" },
  { value: "Working at Heights", category: "Safety & Induction" },
  { value: "Confined Spaces Entry", category: "Safety & Induction" },
  { value: "Electrical Spotter", category: "Electrical" },
  { value: "Electrical Licence - Grade A", category: "Electrical" },
  { value: "Electrical Licence - Grade B", category: "Electrical" },
  { value: "Electrical Licence - Restricted", category: "Electrical" },
  { value: "Heavy Rigid (HR) Licence", category: "Vehicle" },
  { value: "Heavy Combination (HC) Licence", category: "Vehicle" },
  { value: "Multi Combination (MC) Licence", category: "Vehicle" },
  { value: "Medium Rigid (MR) Licence", category: "Vehicle" },
  { value: "Heavy Vehicle (HV) Licence", category: "Vehicle" },
  { value: "Dangerous Goods Driver", category: "Vehicle" },
  { value: "Traffic Control (Stop/Slow)", category: "Traffic" },
  { value: "Traffic Management Implementation", category: "Traffic" },
  { value: "Traffic Management Design", category: "Traffic" },
  { value: "First Aid Certificate", category: "Safety & Induction" },
  { value: "CPR Certificate", category: "Safety & Induction" },
  { value: "Fire Warden", category: "Safety & Induction" },
  { value: "Asbestos Awareness", category: "Safety & Induction" },
  { value: "Asbestos Removal (Class A)", category: "Safety & Induction" },
  { value: "Asbestos Removal (Class B)", category: "Safety & Induction" },
  { value: "Demolition Licence", category: "Safety & Induction" },
  { value: "Blasting Licence", category: "Safety & Induction" },
  { value: "Gas Fitter Licence", category: "Trades" },
  { value: "Plumbing Licence", category: "Trades" },
  { value: "Welding Certificate", category: "Trades" },
  { value: "Concrete Finisher Cert III", category: "Trades" },
  { value: "Carpentry Licence", category: "Trades" },
  { value: "Builder Licence", category: "Trades" },
];

export const TICKET_CATEGORIES = [...new Set(CONSTRUCTION_TICKET_TYPES.map(t => t.category))];

export const AUSTRALIAN_STATES = [
  { value: "VIC", label: "Victoria" },
  { value: "NSW", label: "New South Wales" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
];

export const employeeEditSchema = z.object({
  employeeNumber: z.string().min(1, "Employee number is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleName: z.string().optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  isDraftingResource: z.boolean().default(false),
  isProductionResource: z.boolean().default(false),
  isSiteResource: z.boolean().default(false),
  receiveEscalatedWorkOrders: z.boolean().default(false),
  workRights: z.boolean().default(true),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type EmployeeEditFormData = z.infer<typeof employeeEditSchema>;

export const employmentSchema = z.object({
  employmentType: z.string().default("full_time"),
  positionTitle: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  workLocation: z.string().optional(),
  workState: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  expectedStartDate: z.string().optional(),
  endDate: z.string().optional(),
  probationEndDate: z.string().optional(),
  classificationLevel: z.string().optional(),
  instrumentId: z.string().nullable().optional(),
  status: z.string().default("prospect"),
  baseRate: z.string().optional(),
  rateBasis: z.string().optional(),
  payFrequency: z.string().optional(),
  ordinaryRate: z.string().optional(),
  overtime1_5: z.string().optional(),
  overtime2: z.string().optional(),
  saturdayRate: z.string().optional(),
  sundayRate: z.string().optional(),
  publicHolidayRate: z.string().optional(),
  nightShiftRate: z.string().optional(),
  travelAllowance: z.string().optional(),
  mealAllowance: z.string().optional(),
  toolAllowance: z.string().optional(),
  uniformAllowance: z.string().optional(),
  phoneAllowance: z.string().optional(),
  carAllowance: z.string().optional(),
  shiftAllowance: z.string().optional(),
  annualLeaveHoursPerWeek: z.string().optional(),
  sickLeaveHoursPerWeek: z.string().optional(),
  longServiceLeaveHours: z.string().optional(),
  rdoCount: z.coerce.number().optional(),
  rdoAccrual: z.string().optional(),
  notes: z.string().optional(),
});

export type EmploymentFormData = z.infer<typeof employmentSchema>;

export const documentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().default("other"),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.coerce.number().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  version: z.coerce.number().default(1),
});

export type DocumentFormData = z.infer<typeof documentSchema>;

export const licenceSchema = z.object({
  licenceType: z.string().min(1, "Licence type is required"),
  licenceNumber: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  documentUrl: z.string().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

export type LicenceFormData = z.infer<typeof licenceSchema>;

export function getExpiryBadgeVariant(expiryDate: string | null | undefined): { variant: "default" | "secondary" | "destructive" | "outline"; label: string } {
  if (!expiryDate) return { variant: "secondary", label: "No expiry" };
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { variant: "destructive", label: expiryDate };
  if (diffDays <= 30) return { variant: "outline", label: expiryDate };
  return { variant: "default", label: expiryDate };
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const defaultEmploymentValues: EmploymentFormData = {
  employmentType: "full_time",
  positionTitle: "",
  jobTitle: "",
  department: "",
  departmentId: null,
  workLocation: "",
  workState: "",
  startDate: "",
  expectedStartDate: "",
  endDate: "",
  probationEndDate: "",
  classificationLevel: "",
  instrumentId: "",
  status: "prospect",
  baseRate: "",
  rateBasis: "hourly",
  payFrequency: "weekly",
  ordinaryRate: "",
  overtime1_5: "",
  overtime2: "",
  saturdayRate: "",
  sundayRate: "",
  publicHolidayRate: "",
  nightShiftRate: "",
  travelAllowance: "",
  mealAllowance: "",
  toolAllowance: "",
  uniformAllowance: "",
  phoneAllowance: "",
  carAllowance: "",
  shiftAllowance: "",
  annualLeaveHoursPerWeek: "",
  sickLeaveHoursPerWeek: "",
  longServiceLeaveHours: "",
  rdoCount: undefined,
  rdoAccrual: "",
  notes: "",
};

export const defaultDocumentValues: DocumentFormData = {
  name: "",
  category: "other",
  fileUrl: "",
  fileName: "",
  fileSize: undefined,
  issuedDate: "",
  expiryDate: "",
  notes: "",
  version: 1,
};

export const defaultLicenceValues: LicenceFormData = {
  licenceType: "",
  licenceNumber: "",
  issuingAuthority: "",
  issueDate: "",
  expiryDate: "",
  documentUrl: "",
  status: "active",
  notes: "",
};

export interface OverviewTabProps {
  employee: Employee;
}

export interface EmploymentsTabProps {
  employments: EmployeeEmployment[] | undefined;
  onAdd: () => void;
  onEdit: (emp: EmployeeEmployment) => void;
  onDelete: (id: string) => void;
}

export interface DocumentsTabProps {
  documents: EmployeeDocument[] | undefined;
  onAdd: () => void;
  onEdit: (doc: EmployeeDocument) => void;
  onDelete: (id: string) => void;
}

export interface LicencesTabProps {
  licences: EmployeeLicence[] | undefined;
  onAdd: () => void;
  onEdit: (lic: EmployeeLicence) => void;
  onDelete: (id: string) => void;
}

export interface OnboardingTabProps {
  onboardings: any[] | undefined;
  onboardingsLoading: boolean;
  employments: EmployeeEmployment[] | undefined;
  onStartOnboarding: () => void;
  onUpdateTask: (params: { onboardingId: string; taskId: string; data: any }) => void;
}

export interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<EmployeeEditFormData>;
  onSubmit: (data: EmployeeEditFormData) => void;
  isPending: boolean;
}

export interface EmploymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<EmploymentFormData>;
  onSubmit: (data: EmploymentFormData) => void;
  isPending: boolean;
  isEditing: boolean;
  instruments: any[] | undefined;
  activeDepartments: Department[];
}

export interface DocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<DocumentFormData>;
  onSubmit: (data: DocumentFormData) => void;
  isPending: boolean;
  isEditing: boolean;
}

export interface LicenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<LicenceFormData>;
  onSubmit: (data: LicenceFormData) => void;
  isPending: boolean;
  isEditing: boolean;
  useCustomLicenceType: boolean;
  setUseCustomLicenceType: (v: boolean) => void;
}

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmTestId: string;
  cancelTestId: string;
}

export interface CreateOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employments: EmployeeEmployment[] | undefined;
  templates: any[] | undefined;
  selectedEmploymentId: string;
  setSelectedEmploymentId: (v: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}
