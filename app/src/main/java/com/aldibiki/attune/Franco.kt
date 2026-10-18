package com.aldibiki.attune

/**
 * v6.37 (Ali picked "do them all", upgrade X1): Franco-Arabic ("3arabizi") → Arabic, word by word, as you type.
 * "ana gay bokra" → «أنا جاي بكرة», "7abibi" → «حبيبي», "inshallah" → «إن شاء الله».
 * First a dictionary of everyday Egyptian words (their usual spelling), then the Franco rules for the rest:
 * the number letters (2 ء/أ, 3 ع, 5 خ, 7 ح, 8 غ, 6 ط, 9 ص), sh/kh/gh/th/dh, long vowels (aa ee oo ou) written, short vowels
 * inside a word dropped, a vowel at the start written as أ/إ, at the end as ا/ي/و.
 * Pure Kotlin — no Android — so it is tested on its own (tests/kotlin/FrancoTest.kt).
 */
object Franco {
    private val WORDS: Map<String, String> = mapOf(
        // people, pronouns, small words
        "ana" to "أنا", "enta" to "إنت", "inta" to "إنت", "enti" to "إنتي", "inti" to "إنتي", "e7na" to "إحنا", "i7na" to "إحنا", "ento" to "إنتو", "into" to "إنتو",
        "howa" to "هو", "huwa" to "هو", "heya" to "هي", "hiya" to "هي", "homa" to "هما", "humma" to "هما",
        "ya" to "يا", "w" to "و", "we" to "و", "wa" to "و", "aw" to "أو", "walla" to "ولا", "wala" to "ولا", "bas" to "بس", "lakin" to "لكن", "laken" to "لكن",
        "fe" to "في", "fi" to "في", "fy" to "في", "mn" to "من", "men" to "من", "min" to "من", "3la" to "على", "3ala" to "على", "3al" to "عال", "l" to "ل", "le" to "ل", "li" to "لي",
        "ma3" to "مع", "ma3a" to "مع", "3and" to "عند", "3nd" to "عند", "zay" to "زي", "zai" to "زي", "gamb" to "جنب",
        "da" to "ده", "dah" to "ده", "di" to "دي", "dy" to "دي", "dol" to "دول", "dool" to "دول", "keda" to "كده", "kda" to "كده", "kedda" to "كده",
        "eh" to "إيه", "eih" to "إيه", "ih" to "إيه", "leh" to "ليه", "leih" to "ليه", "ezay" to "إزاي", "ezzay" to "إزاي", "izay" to "إزاي", "imta" to "إمتى", "emta" to "إمتى",
        "fen" to "فين", "fein" to "فين", "feen" to "فين", "meen" to "مين", "min2" to "مين", "kam" to "كام", "anhy" to "أنهي", "anhi" to "أنهي",
        "aywa" to "أيوه", "aiwa" to "أيوه", "aywah" to "أيوه", "la2" to "لأ", "laa" to "لا", "la" to "لا", "na3am" to "نعم", "tab" to "طب", "tayeb" to "طيب", "tyb" to "طيب", "6ayeb" to "طيب",
        "mesh" to "مش", "msh" to "مش", "mish" to "مش", "mafeesh" to "مفيش", "mfeesh" to "مفيش", "mafish" to "مفيش", "fe7" to "فيه", "feeh" to "فيه", "fih" to "فيه",
        "kol" to "كل", "koll" to "كل", "kolo" to "كله", "kollo" to "كله", "7aga" to "حاجة", "7agat" to "حاجات", "7ad" to "حد", "wala7ad" to "ولا حد",
        "awi" to "أوي", "awy" to "أوي", "2awy" to "أوي", "2awi" to "أوي", "gedan" to "جدًا", "giddan" to "جدًا", "shwaya" to "شوية", "shwya" to "شوية", "shewaya" to "شوية", "aktar" to "أكتر", "a2al" to "أقل",
        // verbs people type every day
        "gay" to "جاي", "gaya" to "جاية", "gayeen" to "جايين", "rayeh" to "رايح", "ray7" to "رايح", "ray7a" to "رايحة", "mashy" to "ماشي", "mashi" to "ماشي", "mashya" to "ماشية",
        "3ayez" to "عايز", "3ayz" to "عايز", "3awez" to "عاوز", "3ayza" to "عايزة", "3awza" to "عاوزة", "3ayzeen" to "عايزين", "3awzeen" to "عاوزين",
        "a3raf" to "أعرف", "3aref" to "عارف", "3arfa" to "عارفة", "mesh3aref" to "مش عارف", "fahem" to "فاهم", "fahma" to "فاهمة",
        "ba7ebak" to "بحبك", "b7bk" to "بحبك", "ba7ebek" to "بحبك", "ba7bak" to "بحبك", "7abibi" to "حبيبي", "habibi" to "حبيبي", "7abibti" to "حبيبتي", "7elw" to "حلو", "7elwa" to "حلوة", "7ilw" to "حلو",
        "2olt" to "قلت", "olt" to "قلت", "2ool" to "قول", "2oly" to "قولي", "2olly" to "قولي", "2ollaha" to "قولها", "kalem" to "كلم", "kallem" to "كلم", "kalemni" to "كلمني", "kallemni" to "كلمني", "etkalem" to "اتكلم",
        "ab3at" to "ابعت", "eb3at" to "ابعت", "eb3atly" to "ابعتلي", "ab3atlak" to "أبعتلك", "ba3at" to "بعت", "ba3atlak" to "بعتلك", "estana" to "استنى", "istanna" to "استنى", "estanna" to "استنى",
        "ta3ala" to "تعالى", "ta3ali" to "تعالي", "rou7" to "روح", "roo7" to "روح", "2a3od" to "اقعد", "o3od" to "اقعد", "nam" to "نام", "nayem" to "نايم", "sa7y" to "صاحي", "sa7i" to "صاحي",
        "akal" to "أكل", "akl" to "أكل", "kalt" to "كلت", "neshrab" to "نشرب", "ashrab" to "أشرب", "nenzel" to "ننزل", "nazel" to "نازل", "nazla" to "نازلة", "rege3" to "رجع", "rag3" to "راجع", "rag3a" to "راجعة",
        "e3mel" to "اعمل", "a3mel" to "أعمل", "3amel" to "عامل", "3amla" to "عاملة", "3amleen" to "عاملين", "shoft" to "شفت", "shof" to "شوف", "shoufo" to "شوفه", "ashoof" to "أشوف", "ashofak" to "أشوفك",
        "yalla" to "يلا", "yallah" to "يلا", "nfsy" to "نفسي", "nefsy" to "نفسي", "nefsi" to "نفسي", "lazem" to "لازم", "momken" to "ممكن", "mumkin" to "ممكن", "mmkn" to "ممكن", "ma3lesh" to "معلش", "ma3lish" to "معلش", "m3lsh" to "معلش",
        "khalas" to "خلاص", "5alas" to "خلاص", "5las" to "خلاص", "5alaas" to "خلاص", "khalli" to "خلي", "5aly" to "خلي", "5alli" to "خلي", "sa7" to "صح", "sa77" to "صح", "ghalat" to "غلط", "8alat" to "غلط",
        "estanany" to "استناني", "ats2al" to "أسأل", "as2al" to "أسأل", "so2al" to "سؤال", "radd" to "رد", "rod" to "رد", "rodd" to "رد",
        // time
        "delwa2ty" to "دلوقتي", "dlw2ty" to "دلوقتي", "delwa2ti" to "دلوقتي", "dlwa2ty" to "دلوقتي", "naharda" to "النهارده", "elnaharda" to "النهارده", "nhrda" to "النهارده",
        "bokra" to "بكرة", "bukra" to "بكرة", "bkra" to "بكرة", "embare7" to "امبارح", "imbare7" to "امبارح", "mbar7" to "امبارح", "ba3d" to "بعد", "abl" to "قبل", "2abl" to "قبل", "badry" to "بدري", "badri" to "بدري",
        "sa3a" to "ساعة", "sa3et" to "ساعة", "de2i2a" to "دقيقة", "d2i2a" to "دقيقة", "yom" to "يوم", "youm" to "يوم", "esbo3" to "أسبوع", "osbo3" to "أسبوع", "shahr" to "شهر", "sana" to "سنة",
        "ba3den" to "بعدين", "ba3deen" to "بعدين", "dayman" to "دايمًا", "abadan" to "أبدًا", "lessa" to "لسه", "lesa" to "لسه", "lissa" to "لسه", "3ala6ool" to "على طول", "3atool" to "على طول",
        "elsabt" to "السبت", "sabt" to "السبت", "el7ad" to "الحد", "letnen" to "الاتنين", "elitnein" to "الاتنين", "eltalat" to "التلات", "elarba3" to "الأربع", "el5amis" to "الخميس", "elkhamis" to "الخميس", "elgom3a" to "الجمعة", "gom3a" to "الجمعة",
        // greetings, God
        "salam" to "سلام", "salamo" to "السلام", "3aleko" to "عليكم", "3alikom" to "عليكم", "ahlan" to "أهلًا", "ahln" to "أهلًا", "marhaba" to "مرحبا", "sabah" to "صباح", "masa2" to "مساء", "elkheir" to "الخير", "el5eir" to "الخير", "elfol" to "الفل", "elful" to "الفل",
        "shokran" to "شكرًا", "shukran" to "شكرًا", "merci" to "ميرسي", "mersi" to "ميرسي", "3afwan" to "عفوًا", "afwan" to "عفوًا", "mabrook" to "مبروك", "mabrouk" to "مبروك", "alf" to "ألف",
        "inshallah" to "إن شاء الله", "insha2allah" to "إن شاء الله", "isa" to "إن شاء الله", "nshallah" to "إن شاء الله", "mashallah" to "ما شاء الله", "mashaallah" to "ما شاء الله", "alhamdulillah" to "الحمد لله", "el7amdulillah" to "الحمد لله", "7amdlellah" to "الحمد لله", "el7amdolelah" to "الحمد لله",
        "wallahi" to "والله", "wallah" to "والله", "wlahy" to "والله", "wallahy" to "والله", "rabena" to "ربنا", "rabbena" to "ربنا", "allah" to "الله",
        "ezayak" to "إزيك", "ezayek" to "إزيك", "ezzayak" to "إزيك", "ezaik" to "إزيك", "3amel eh" to "عامل إيه", "tamam" to "تمام", "tmam" to "تمام", "kowayes" to "كويس", "kwayes" to "كويس", "kwais" to "كويس", "kowayesa" to "كويسة", "kwayesa" to "كويسة",
        // home, family, money, work
        "beit" to "بيت", "bet" to "بيت", "bait" to "بيت", "sha2a" to "شقة", "3arabeya" to "عربية", "3rbya" to "عربية", "3arabiya" to "عربية", "shoghl" to "شغل", "sho8l" to "شغل", "shogl" to "شغل", "sherka" to "شركة", "maktab" to "مكتب",
        "mama" to "ماما", "baba" to "بابا", "akhoya" to "أخويا", "a5oya" to "أخويا", "o5ty" to "أختي", "okhti" to "أختي", "sa7by" to "صاحبي", "sa7bi" to "صاحبي", "sa7bty" to "صاحبتي", "3elah" to "عيلة",
        "felos" to "فلوس", "flos" to "فلوس", "floos" to "فلوس", "geneh" to "جنيه", "gneh" to "جنيه", "ghaly" to "غالي", "8aly" to "غالي", "rekhis" to "رخيص", "re5ees" to "رخيص", "se3r" to "سعر", "es3ar" to "أسعار",
        "mayya" to "مية", "maya" to "مية", "ahwa" to "قهوة", "2ahwa" to "قهوة", "shay" to "شاي", "shai" to "شاي",
        "taban" to "تعبان", "ta3ban" to "تعبان", "ta3bana" to "تعبانة", "mabsoot" to "مبسوط", "mabsout" to "مبسوط", "za3lan" to "زعلان", "za3lana" to "زعلانة", "5ayef" to "خايف",
        "7ader" to "حاضر", "ok" to "أوكي", "okay" to "أوكي", "oki" to "أوكي",
        // names (h in a Latin name is often ح, so the rules alone would guess wrong)
        "ahmed" to "أحمد", "a7med" to "أحمد", "mohamed" to "محمد", "mo7amed" to "محمد", "mohammed" to "محمد", "mahmoud" to "محمود", "ma7moud" to "محمود", "mostafa" to "مصطفى", "moustafa" to "مصطفى",
        "ali" to "علي", "aly" to "علي", "3ali" to "علي", "omar" to "عمر", "3omar" to "عمر", "hassan" to "حسن", "7assan" to "حسن", "hussein" to "حسين", "7ussein" to "حسين", "ibrahim" to "إبراهيم", "youssef" to "يوسف", "yousef" to "يوسف",
        "khaled" to "خالد", "5aled" to "خالد", "tarek" to "طارق", "karim" to "كريم", "kareem" to "كريم", "amr" to "عمرو", "3amr" to "عمرو", "sherif" to "شريف", "hany" to "هاني", "hani" to "هاني", "walid" to "وليد",
        "mona" to "منى", "sara" to "سارة", "nour" to "نور", "noor" to "نور", "fatma" to "فاطمة", "mariam" to "مريم", "maryam" to "مريم", "salma" to "سلمى", "hana" to "هنا", "aya" to "آية", "yasmin" to "ياسمين", "nada" to "ندى", "heba" to "هبة",
        "ma3ak" to "معاك", "ma3aky" to "معاكي", "ma3aya" to "معايا", "liya" to "ليا", "leya" to "ليا", "lik" to "ليك", "leek" to "ليك", "leky" to "ليكي", "3alek" to "عليك", "3alaya" to "عليا",
    )
    /** Words that stay as they are (a link, an e-mail, a code, English that isn't Franco). */
    private val KEEP = setOf("lol", "omg", "pdf", "gps", "wifi", "usb", "ok?")

    private val LETTER = mapOf(
        'b' to "ب", 'p' to "ب", 't' to "ت", 'g' to "ج", 'j' to "ج", 'd' to "د", 'r' to "ر", 'z' to "ز", 's' to "س", 'f' to "ف", 'v' to "ف", 'k' to "ك", 'c' to "ك",
        'q' to "ق", 'l' to "ل", 'm' to "م", 'n' to "ن", 'h' to "ه", 'w' to "و", 'y' to "ي", 'x' to "كس",
        '2' to "ء", '3' to "ع", '5' to "خ", '7' to "ح", '8' to "غ", '6' to "ط", '9' to "ص",
    )
    private const val VOWELS = "aeiou"

    /** True when the word looks like Franco (Latin letters, maybe the number letters) — not a number, link or e-mail. */
    fun isFranco(w: String): Boolean {
        if (w.isEmpty() || w.length > 30) return false
        if (!w.any { it in 'a'..'z' || it in 'A'..'Z' }) return false
        if (w.contains('@') || w.contains('/') || w.contains('.') || w.contains(':')) return false
        return w.all { it in 'a'..'z' || it in 'A'..'Z' || it in "2356789'" }
    }

    /** One word → Arabic (or the word itself when it shouldn't change). */
    fun word(input: String): String {
        val w = input.lowercase()
        if (!isFranco(input) || w in KEEP) return input
        WORDS[w]?.let { return it }
        // el-/al- = "ال" in front of a known word: "elbeit" → البيت
        for (p in listOf("el", "al", "il")) if (w.length > p.length + 2 && w.startsWith(p)) WORDS[w.substring(p.length)]?.let { return "ال" + it.removePrefix("ال") }
        return rules(w)
    }

    private fun rules(w: String): String {
        val out = StringBuilder()
        var i = 0
        val n = w.length
        while (i < n) {
            val c = w[i]
            val two = if (i + 1 < n) w.substring(i, i + 2) else ""
            val first = i == 0
            val last = i == n - 1
            when {
                two == "sh" || two == "ch" -> { out.append("ش"); i += 2; continue }
                two == "kh" -> { out.append("خ"); i += 2; continue }
                two == "gh" -> { out.append("غ"); i += 2; continue }
                two == "th" -> { out.append("ث"); i += 2; continue }
                two == "dh" -> { out.append("ذ"); i += 2; continue }
                two == "3'" -> { out.append("غ"); i += 2; continue }
                two == "7'" -> { out.append("خ"); i += 2; continue }
                two == "aa" -> { out.append(if (first) "آ" else "ا"); i += 2; continue }
                two == "ee" || two == "ei" -> { if (first) out.append("إ"); out.append("ي"); i += 2; continue }
                (two == "ay" || two == "ai") && i + 2 == n -> { out.append(if (first) "آي" else "اي"); i += 2; continue }   // "gay" → جاي
                two == "oo" || two == "ou" -> { if (first) out.append("أ"); out.append("و"); i += 2; continue }
            }
            if (c in VOWELS) {
                when {
                    first -> out.append(if (c == 'e' || c == 'i') "إ" else "أ")
                    last -> out.append(if (c == 'a') "ا" else if (c == 'e' || c == 'i') "ي" else "و")
                    // a short vowel inside a word is not written in Arabic
                }
                i++; continue
            }
            if (c == '2' && first) { out.append("أ"); i++; continue }
            if (c == '\'') { i++; continue }
            // a doubled consonant is written once (the shadda is left out)
            if (i > 0 && w[i - 1] == c && c !in VOWELS) { i++; continue }
            out.append(LETTER[c] ?: c.toString())
            i++
        }
        return out.toString()
    }

    /** A whole text, word by word (punctuation and spaces kept; "?" → "؟", "," → "،"). */
    fun text(s: String): String {
        val re = Regex("[A-Za-z0-9']+")
        val converted = re.replace(s) { m -> if (m.value.all { it.isDigit() }) m.value else word(m.value) }
        return converted.replace('?', '؟').replace(',', '،')
    }
}
