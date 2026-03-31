import { useState } from "react";
import { Mic, Loader2, ImageIcon, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractedAudio, ExtractedImage } from "@/lib/pdfMediaExtractor";

interface ChatMediaSectionProps {
  audioBlobs?: ExtractedAudio[];
  imageBlobs?: ExtractedImage[];
}

export function ChatMediaSection({ audioBlobs, imageBlobs }: ChatMediaSectionProps) {
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const hasAudio = audioBlobs && audioBlobs.length > 0;
  const hasImages = imageBlobs && imageBlobs.length > 0;

  if (!hasAudio && !hasImages) return null;

  const handleTranscribe = async (audio: ExtractedAudio) => {
    if (transcriptions[audio.name] || transcribing[audio.name]) return;
    setTranscribing((prev) => ({ ...prev, [audio.name]: true }));

    try {
      const formData = new FormData();
      formData.append("file", audio.blob, audio.name);

      const { data, error } = await supabase.functions.invoke("transcrever-audio", {
        body: formData,
      });

      if (error) throw error;
      setTranscriptions((prev) => ({ ...prev, [audio.name]: data?.text || "(sem texto)" }));
    } catch (err) {
      console.error("Erro ao transcrever:", err);
      setTranscriptions((prev) => ({ ...prev, [audio.name]: "Erro na transcrição" }));
    } finally {
      setTranscribing((prev) => ({ ...prev, [audio.name]: false }));
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Audio section */}
      {hasAudio && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Mic className="h-4 w-4" />
            🎤 Áudios do atendimento
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {audioBlobs.length}
            </Badge>
          </div>
          {audioBlobs.map((audio) => (
            <div
              key={audio.name}
              className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mic className="h-3 w-3" />
                <span className="font-mono">{audio.name}</span>
              </div>
              <audio controls src={audio.url} className="w-full h-8" preload="metadata" />
              {transcriptions[audio.name] ? (
                <div className="text-xs italic text-muted-foreground bg-muted/30 rounded-md p-2">
                  📝 {transcriptions[audio.name]}
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={transcribing[audio.name]}
                  onClick={() => handleTranscribe(audio)}
                >
                  {transcribing[audio.name] ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Transcrevendo...
                    </>
                  ) : (
                    "Transcrever"
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image section */}
      {hasImages && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            📎 Imagens do atendimento
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {imageBlobs.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            {imageBlobs.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setLightboxUrl(img.url)}
                className="group relative rounded-lg border border-border/40 overflow-hidden hover:border-primary/50 transition-colors"
                style={{ width: 80, height: 80 }}
              >
                <img
                  src={img.url}
                  alt={`Imagem pág. ${img.pageNum}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-black/50 text-white py-0.5">
                  {img.width > 400 ? "📄 Documento enviado" : "🔎 Imagem enviada no atendimento"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-2">
          <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Imagem do atendimento"
              className="w-full h-auto rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
