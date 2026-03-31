export function readFileAsResumeString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };
    const isPlainText =
      file.type.startsWith("text/") ||
      /\.(txt|md|csv)$/i.test(file.name);
    if (isPlainText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}
