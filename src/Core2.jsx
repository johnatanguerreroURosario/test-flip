import {
  usePdfiumEngine,
  PdfEngineProvider,
  useEngineContext,
} from "@embedpdf/engines/react";
import { RenderPluginPackage } from "@embedpdf/plugin-render/react";
import { LoaderPluginPackage } from "@embedpdf/plugin-loader/react";
import { EmbedPDF } from "@embedpdf/core/react";
import { createPluginRegistration } from "@embedpdf/core";

const plugins = [
  createPluginRegistration(LoaderPluginPackage, {
    loadingOptions: {
      type: "url",
      pdfFile: {
        id: "1",
        url: "https://snippet.embedpdf.com/ebook.pdf",
      },
      options: {
        mode: "full-fetch",
      },
    },
  }),
  createPluginRegistration(RenderPluginPackage),
];

export default function Main() {
  const { engine, isLoading, error } = usePdfiumEngine();

  return (
    <PdfEngineProvider engine={engine} isLoading={isLoading} error={error}>
      <MyViewerComponent />
      <SomeOtherComponent />
    </PdfEngineProvider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
function MyViewerComponent() {
  const { engine, isLoading, error } = useEngineContext();

  if (isLoading) {
    return <div>Loading PDF Engine...</div>;
  }
  if (error) {
    return <div>Error loading engine: {error.message}</div>;
  }

  const renderPage = ({ width, height, pageIndex, scale }) => (
    <div style={{ width, height, position: "relative" }}>
      {/* The RenderLayer is responsible for drawing the page */}
      <RenderLayer pageIndex={pageIndex} scale={scale} />
    </div>
  );

  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {({ pageIndex, scale }) =>
        renderPage({ width: 1000, height: 700, pageIndex, scale })
      }
    </EmbedPDF>
  );
}
