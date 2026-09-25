// Missing-backend previews render the real frontend without pretending a save succeeded.
function unavailable() {
  return Response.json(
    {
      success: false,
      message: "Online services are not connected yet.",
      error: { code: "BACKEND_NOT_CONFIGURED" },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export {
  unavailable as GET,
  unavailable as POST,
  unavailable as PUT,
  unavailable as PATCH,
  unavailable as DELETE,
};
