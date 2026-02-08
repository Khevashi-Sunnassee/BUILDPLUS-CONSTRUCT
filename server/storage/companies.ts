import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { companies, users, type Company, type InsertCompany } from "@shared/schema";

export const companyMethods = {
  async getAllCompanies(): Promise<(Company & { userCount: number })[]> {
    const allCompanies = await db.select().from(companies).orderBy(desc(companies.createdAt));
    const result = await Promise.all(
      allCompanies.map(async (company) => {
        const companyUsers = await db.select().from(users).where(eq(users.companyId, company.id));
        return {
          ...company,
          userCount: companyUsers.length,
        };
      })
    );
    return result;
  },

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  },

  async getCompanyByCode(code: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.code, code));
    return company;
  },

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  },

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  },

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  },
};
