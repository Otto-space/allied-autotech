import { expect, it } from "vitest";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
it("preserves the appointment pending approval and describes independent managed responsibilities", () => {
  const article = learningArticles.find((row) => row.id === "booking-confirmation")!;
  expect(article.version).toBe(10);
  expect(article.gate).toBe("booking-confirmation");
  expect(article.href).toBe("/admin/workforce/bookings");
  const text = article.steps.join(" ");
  for (const phrase of [
    "preserves the original appointment, staff and reminders",
    "assignment responsibility at both branches",
    "switches the appointment and reminders atomically",
    "customer-visible decision reason",
    "A conflict or decline leaves the original unchanged",
    "do not retry automatically",
  ])
    expect(text).toContain(phrase);
  expect(text).not.toContain("clears the previous staff assignment");
});

it("explains individual timing review without granting service-editing permission or promising collection", () => {
  const work = learningArticles.find((row) => row.id === "booking-confirmation")!;
  const text = work.steps.join(" ");
  for (const phrase of [
    "Review appointment timing",
    "zero must be explicit",
    "internal reason",
    "start and status stay unchanged",
    "without rewriting saved booking estimates",
  ])
    expect(text).toContain(phrase);
  const publicText = learningArticles
    .find((row) => row.id === "service-request")!
    .steps.join(" ");
  expect(publicText).toContain("not a promised completion or vehicle-collection time");
  expect(publicText).toContain("An unassessed time remains unknown");
});

it("explains stale offers and carried estimates independently of resource allocation", () => {
  const text = learningArticles
    .find((row) => row.id === "booking-confirmation")!
    .steps.join(" ");
  expect(text).toContain("Timing review required");
  expect(text).toContain("later defaults do not silently replace it");
  expect(text).toContain("A service edit after the review is rejected");
  expect(text).toContain("even after cancellation");
  expect(text).toContain("matching replacement slot");
});

it("keeps resource configuration separate from appointment reservations and staff permissions", () => {
  const work = learningArticles.find((row) => row.id === "booking-confirmation")!;
  expect(work.gate).toBe("booking-confirmation");
  expect(work.steps.join(" ")).toContain(
    "does not reserve equipment or grant anyone work permission",
  );
});

it("explains resource allocation, rollback, cleanup and unknown legacy work without inventing availability", () => {
  const work = learningArticles
    .find((row) => row.id === "booking-confirmation")!
    .steps.join(" ");
  for (const phrase of [
    "records the allocation atomically",
    "without deleting allocation history",
    "preserves the original booking and resources",
    "recorded cleanup period",
    "elapsed estimate does not prove",
    "older work lacks a resource assessment",
  ])
    expect(work).toContain(phrase);
  const customer = learningArticles.find((row) => row.id === "service-request")!;
  expect(customer.version).toBe(27);

  expect(customer.steps.join(" ")).toContain("a booked vehicle takes priority");
  expect(customer.steps.join(" ")).toContain("does not change a booking");
  expect(customer.steps.join(" ")).toContain("does not create a payment");
});
