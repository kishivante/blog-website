import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";

export const postEditorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: {
      autolink: true,
      openOnClick: false,
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "nofollow noopener noreferrer" },
    },
    underline: {},
  }),
  Image.configure({
    allowBase64: false,
    HTMLAttributes: { loading: "lazy", decoding: "async" },
  }),
  TableKit.configure({ table: { resizable: false } }),
];
