export function ReceiptPreview({ imageUrl, scanning }: { imageUrl: string; scanning: boolean }) {
  return (
    <div className="receipt-preview" aria-label="Anteprima del documento">
      <img src={imageUrl} alt="Documento acquisito" />
      {scanning && <span className="receipt-preview-scan" aria-hidden="true" />}
    </div>
  )
}
