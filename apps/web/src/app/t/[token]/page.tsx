import TrackingClient from "../TrackingClient";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const p = await params;
  return <TrackingClient token={p.token} />;
}
