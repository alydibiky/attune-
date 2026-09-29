package android.print

import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import java.io.File

/**
 * v6.8 — prints a WebView's page straight to a PDF file, without the print dialog (File Converter:
 * Word / Excel / web page / text → PDF, laid out by the phone's own Chrome engine, so Arabic, fonts,
 * tables and pictures come out as they should). It sits in android.print because the print callbacks
 * can only be made from this package. If a phone refuses it, the caller falls back to DocTools.makePdf.
 */
object AttunePdfPrinter {
    fun print(adapter: PrintDocumentAdapter, attrs: PrintAttributes, file: File, done: (Throwable?) -> Unit) {
        var finished = false
        fun end(e: Throwable?) { if (!finished) { finished = true; try { adapter.onFinish() } catch (x: Throwable) { }; done(e) } }
        try {
            adapter.onStart()
            adapter.onLayout(null, attrs, CancellationSignal(), object : PrintDocumentAdapter.LayoutResultCallback() {
                override fun onLayoutFinished(info: PrintDocumentInfo?, changed: Boolean) {
                    try {
                        val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_READ_WRITE)
                        adapter.onWrite(arrayOf(PageRange.ALL_PAGES), pfd, CancellationSignal(), object : PrintDocumentAdapter.WriteResultCallback() {
                            override fun onWriteFinished(pages: Array<out PageRange>?) { try { pfd.close() } catch (x: Throwable) { }; end(null) }
                            override fun onWriteFailed(error: CharSequence?) { try { pfd.close() } catch (x: Throwable) { }; end(Exception(error?.toString() ?: "The page could not be printed")) }
                            override fun onWriteCancelled() { try { pfd.close() } catch (x: Throwable) { }; end(Exception("Printing was cancelled")) }
                        })
                    } catch (e: Throwable) { end(e) }
                }
                override fun onLayoutFailed(error: CharSequence?) { end(Exception(error?.toString() ?: "The page could not be laid out")) }
                override fun onLayoutCancelled() { end(Exception("Printing was cancelled")) }
            }, null)
        } catch (e: Throwable) { end(e) }
    }
}
