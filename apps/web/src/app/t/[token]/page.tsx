import TrackingClient from "../TrackingClient";

export default async function Page({ params }: { params: Promise<{ token: string }> | { token: string } }) {
  const p = await params as { token: string };
  return <TrackingClient token={p.token} />;
}
