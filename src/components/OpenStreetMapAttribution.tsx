export default function OpenStreetMapAttribution() {
  return (
    <p className="text-center text-xs leading-relaxed text-slate-600 dark:text-slate-400">
      Place data ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        OpenStreetMap contributors
      </a>
    </p>
  );
}
