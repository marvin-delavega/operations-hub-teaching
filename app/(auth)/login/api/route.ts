import { NextResponse } from "next/server";
import { createGetAppSettingUseCase } from "@/container";
import { isDbConfigured } from "@/shared/infrastructure/dbConfig";

export async function GET() {
  // Signals first-run: when the DB isn't configured the login screen redirects to /connect.
  const dbConfigured = isDbConfigured();
  try {
    const value = await createGetAppSettingUseCase().execute("company_name");
    const companyName = value?.trim() || null;
    return NextResponse.json({ companyName, dbConfigured });
  } catch {
    return NextResponse.json({ companyName: null, dbConfigured });
  }
}
