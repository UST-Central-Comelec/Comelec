import { FileText } from "lucide-react";
import { documentTypeLabels as labels, isWorkingDocumentLink, type WorkingDocument, type WorkingDocumentKind } from "@/lib/letters/options";
import { documentService, documentServiceLabels, type DocumentService } from "@/lib/letters/document-services";
import { DocumentServiceIcon } from "./document-service-icon";

function DocumentIcon({ kind }: { kind: WorkingDocumentKind }) {
  if (kind === "pdf") return <FileText size={18} color="#e05252" aria-hidden="true" />;
  if (kind === "drive") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#0F9D58" d="M8 2h8L8 16H0z" /><path fill="#F4B400" d="M16 2l8 14h-8L8 2z" /><path fill="#4285F4" d="M0 16h24l-4 7H4z" /></svg>;
  return <svg width="18" height="20" viewBox="0 0 20 24" aria-hidden="true">
    <path fill={kind === "docs" ? "#4285F4" : "#0F9D58"} d="M2 0h10l8 8v14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z" />
    <path fill={kind === "docs" ? "#A1C2FA" : "#87CEAC"} d="M12 0v8h8Z" />
    {kind === "docs" ? <path fill="none" stroke="white" strokeWidth="1.5" d="M4 12h12M4 15h12M4 18h8" /> : <path fill="none" stroke="white" strokeWidth="1.2" d="M4 12h12v8H4zM4 16h12M9 12v8" />}
  </svg>;
}

export function WorkingDocumentLink({ documents, modal = false }: { documents: WorkingDocument[]; modal?: boolean }) {
  return <span className={`portal-document-icons${modal ? " portal-letter-modal-link" : ""}`}>
    {(Object.keys(labels) as WorkingDocumentKind[]).flatMap(format => {
      const matches = documents.filter(document => document.type === format && isWorkingDocumentLink(document));
      if (format === "pdf" && modal) {
        const services: Array<DocumentService | null> = [null, ...Object.keys(documentServiceLabels) as DocumentService[]];
        return services.flatMap(service => {
          const links = matches.filter(document => documentService(document.url) === service);
          const label = service ? documentServiceLabels[service] : labels.pdf;
          const icon = service ? <DocumentServiceIcon service={service} /> : <DocumentIcon kind="pdf" />;
          return links.length
            ? links.map((document, index) => <a key={`${service ?? "pdf"}-${index}`} className="portal-document-icon is-active" href={document.url} target="_blank" rel="noopener noreferrer" aria-label={`Open working document (${label})${links.length > 1 ? ` ${index + 1}` : ""}`} title={`${label}${links.length > 1 ? ` ${index + 1}` : ""}`}>{icon}</a>)
            : [<span key={service ?? "pdf"} className="portal-document-icon is-inactive" role="img" aria-label={`${label} (unavailable)`} title={label}>{icon}</span>];
        });
      }
      if (format === "pdf") return matches.map((document, index) => {
        const service = documentService(document.url);
        const label = service ? documentServiceLabels[service] : labels.pdf;
        return <a key={`${format}-${index}`} className="portal-document-icon is-active" href={document.url} target="_blank" rel="noopener noreferrer" aria-label={`Open working document (${label})`} title={label}>{service ? <DocumentServiceIcon service={service} /> : <DocumentIcon kind="pdf" />}</a>;
      });
      return matches.length
        ? matches.map((document, index) => <a key={`${format}-${index}`} className="portal-document-icon is-active" href={document.url} target="_blank" rel="noopener noreferrer" aria-label={`Open working document (${labels[format]})${matches.length > 1 ? ` ${index + 1}` : ""}`} title={`${labels[format]}${matches.length > 1 ? ` ${index + 1}` : ""}`}><DocumentIcon kind={format} /></a>)
        : [<span key={format} className="portal-document-icon is-inactive" role="img" aria-label={`${labels[format]} (unavailable)`} title={labels[format]}><DocumentIcon kind={format} /></span>];
    })}
  </span>;
}
