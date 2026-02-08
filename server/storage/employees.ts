import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "../db";
import {
  employees, employeeEmployments, employeeDocuments, employeeLicences,
  type Employee, type InsertEmployee,
  type EmployeeEmployment, type InsertEmployeeEmployment,
  type EmployeeDocument, type InsertEmployeeDocument,
  type EmployeeLicence, type InsertEmployeeLicence,
} from "@shared/schema";

export const employeeMethods = {
  async getAllEmployees(companyId: string): Promise<Employee[]> {
    return db.select().from(employees)
      .where(eq(employees.companyId, companyId))
      .orderBy(asc(employees.lastName), asc(employees.firstName));
  },

  async getActiveEmployees(companyId: string): Promise<Employee[]> {
    return db.select().from(employees)
      .where(and(eq(employees.companyId, companyId), eq(employees.isActive, true)))
      .orderBy(asc(employees.lastName), asc(employees.firstName));
  },

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  },

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(data).returning();
    return employee;
  },

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [employee] = await db.update(employees)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();
    return employee;
  },

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  },

  async getEmployeeEmployments(employeeId: string): Promise<EmployeeEmployment[]> {
    return db.select().from(employeeEmployments)
      .where(eq(employeeEmployments.employeeId, employeeId))
      .orderBy(desc(employeeEmployments.startDate));
  },

  async getEmployeeEmployment(id: string): Promise<EmployeeEmployment | undefined> {
    const [employment] = await db.select().from(employeeEmployments)
      .where(eq(employeeEmployments.id, id));
    return employment;
  },

  async createEmployeeEmployment(data: InsertEmployeeEmployment): Promise<EmployeeEmployment> {
    const [employment] = await db.insert(employeeEmployments).values(data).returning();
    return employment;
  },

  async updateEmployeeEmployment(id: string, data: Partial<InsertEmployeeEmployment>): Promise<EmployeeEmployment | undefined> {
    const [employment] = await db.update(employeeEmployments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeEmployments.id, id))
      .returning();
    return employment;
  },

  async deleteEmployeeEmployment(id: string): Promise<void> {
    await db.delete(employeeEmployments).where(eq(employeeEmployments.id, id));
  },

  async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    return db.select().from(employeeDocuments)
      .where(eq(employeeDocuments.employeeId, employeeId))
      .orderBy(desc(employeeDocuments.createdAt));
  },

  async getEmployeeDocument(id: string): Promise<EmployeeDocument | undefined> {
    const [doc] = await db.select().from(employeeDocuments)
      .where(eq(employeeDocuments.id, id));
    return doc;
  },

  async createEmployeeDocument(data: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const [doc] = await db.insert(employeeDocuments).values(data).returning();
    return doc;
  },

  async updateEmployeeDocument(id: string, data: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined> {
    const [doc] = await db.update(employeeDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeDocuments.id, id))
      .returning();
    return doc;
  },

  async deleteEmployeeDocument(id: string): Promise<void> {
    await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
  },

  async getEmployeeLicences(employeeId: string): Promise<EmployeeLicence[]> {
    return db.select().from(employeeLicences)
      .where(eq(employeeLicences.employeeId, employeeId))
      .orderBy(desc(employeeLicences.expiryDate));
  },

  async getEmployeeLicence(id: string): Promise<EmployeeLicence | undefined> {
    const [licence] = await db.select().from(employeeLicences)
      .where(eq(employeeLicences.id, id));
    return licence;
  },

  async createEmployeeLicence(data: InsertEmployeeLicence): Promise<EmployeeLicence> {
    const [licence] = await db.insert(employeeLicences).values(data).returning();
    return licence;
  },

  async updateEmployeeLicence(id: string, data: Partial<InsertEmployeeLicence>): Promise<EmployeeLicence | undefined> {
    const [licence] = await db.update(employeeLicences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeLicences.id, id))
      .returning();
    return licence;
  },

  async deleteEmployeeLicence(id: string): Promise<void> {
    await db.delete(employeeLicences).where(eq(employeeLicences.id, id));
  },
};
