import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkCategoryDetail } from "@/app/components/work-category-detail";
import "../../services/services.css";
import "../../services/[serviceId]/service-detail.css";
import "../service-categories.css";
import "./category-detail.css";

export default async function Page({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  if (!z.uuid().safeParse(categoryId).success) notFound();
  return <WorkCategoryDetail categoryId={categoryId} />;
}
