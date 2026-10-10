// v6.10 — a test PDF whose maths symbols have NO text behind them (as in many real PDFs: a font with a custom encoding and
// no ToUnicode map): the ToUnicode maps of the fonts whose name matches a pattern are removed.
//   java -cp pdfbox-app.jar StripToUnicode.java in.pdf out.pdf STIX
import java.io.File;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.cos.COSName;

public class StripToUnicode {
    public static void main(String[] a) throws Exception {
        try (PDDocument d = PDDocument.load(new File(a[0]))) {
            int n = 0;
            for (PDPage p : d.getPages())
                for (COSName k : p.getResources().getFontNames()) {
                    PDFont f = p.getResources().getFont(k);
                    if (f != null && f.getName() != null && f.getName().contains(a[2]) && f.getCOSObject().containsKey(COSName.TO_UNICODE)) { f.getCOSObject().removeItem(COSName.TO_UNICODE); n++; }
                }
            d.setAllSecurityToBeRemoved(true);
            d.save(new File(a[1]));
            System.out.println("removed " + n + " ToUnicode maps");
        }
    }
}
