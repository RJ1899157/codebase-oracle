import "./globals.css";

export const metadata = {
  title: "Codebase Oracle - GraphRAG for GitHub Repositories",
  description: "Interactive GraphRAG exploration and question answering for codebases",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}