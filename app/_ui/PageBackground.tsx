import { InteractiveBackground } from "@/app/_ui/InteractiveBackground";

/**
 * Shared atmospheric backdrop so every page matches the landing page:
 *  - drifting ambient gold glows,
 *  - a giant faint brand watermark,
 *  - the interactive "verified network" canvas.
 *
 * The page wrapper still owns `grain` + the `#080808` base colour; this only
 * adds the floating layers on top of that base (all pointer-events-none, z-0).
 */
export function PageBackground({
  watermark = "TRUSTDROP",
  network = true,
}: {
  watermark?: string | null;
  network?: boolean;
}) {
  return (
    <>
      {/* Ambient gold glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="blob drift"
          style={{
            position: "absolute",
            top: "-120px",
            left: "-100px",
            width: "700px",
            height: "700px",
            background: "radial-gradient(circle, rgba(240,169,59,0.14), transparent 65%)",
            borderRadius: "9999px",
            filter: "blur(90px)",
          }}
        />
        <div
          className="blob drift-slow"
          style={{
            position: "absolute",
            top: "5%",
            right: "-250px",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(240,169,59,0.07), transparent 65%)",
            borderRadius: "9999px",
            filter: "blur(90px)",
          }}
        />
        <div
          className="blob drift"
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "30%",
            width: "500px",
            height: "500px",
            background: "radial-gradient(circle, rgba(240,169,59,0.05), transparent 65%)",
            borderRadius: "9999px",
            filter: "blur(70px)",
          }}
        />
      </div>

      {/* Background watermark */}
      {watermark && (
        <div aria-hidden className="watermark-bg pointer-events-none select-none">
          {watermark}
        </div>
      )}

      {network && <InteractiveBackground />}
    </>
  );
}
