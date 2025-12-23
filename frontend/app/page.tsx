
import Chat from "../components/Chat";
export default function Page() {
  return <>
  <Chat/>
  </>
   ;
}


// "use client";
// import { useState } from "react";
//
// export default function Page() {
//   const [query, setQuery] = useState("");
//   const [output, setOutput] = useState("");
//   const [loading, setLoading] = useState(false);
//
//   function startChat() {
//     if (!query.trim()) return;
//
//     setOutput("");
//     setLoading(true);
//
//     const es = new EventSource(
//       `http://localhost:8000/chat/stream?query=${encodeURIComponent(query)}`
//     );
//
//     es.addEventListener("tool", (e: MessageEvent) => {
//       const data = JSON.parse(e.data);
//       setOutput((prev) => prev + `\n🔧 ${data.message}\n`);
//     });
//
//     es.addEventListener("text", (e: MessageEvent) => {
//       setOutput((prev) => prev + e.data);
//     });
//
//     es.addEventListener("citation", (e: MessageEvent) => {
//       const c = JSON.parse(e.data);
//       setOutput(
//         (prev) =>
//           prev + `\n[${c.id}] ${c.document} (page ${c.page})\n`
//       );
//     });
//
//     es.addEventListener("done", () => {
//       setLoading(false);
//       es.close();
//     });
//
//     es.onerror = () => {
//       setLoading(false);
//       es.close();
//     };
//   }
//
//   return (
//     <main style={{ maxWidth: 700, margin: "40px auto" }}>
//       <h1>AI Search Chat</h1>
//
//       <div style={{ display: "flex", gap: 8 }}>
//         <input
//           style={{ flex: 1, padding: 8 }}
//           placeholder="Ask something..."
//           value={query}
//           onChange={(e) => setQuery(e.target.value)}
//         />
//         <button onClick={startChat} disabled={loading}>
//           {loading ? "Thinking..." : "Send"}
//         </button>
//       </div>
//
//       <pre
//         style={{
//             color:"#000000",
//           marginTop: 20,
//           padding: 16,
//           background: "#f5f5f5",
//           minHeight: 200,
//           whiteSpace: "pre-wrap",
//         }}
//       >
//         {output}
//       </pre>
//     </main>
//   );
// }
//
