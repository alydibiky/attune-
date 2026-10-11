"""v6.20 — the Q&A Knowledge packs from Stack Exchange (Ali: "add huge databases for knowledge packs … so the app doesn't do a
lot of internet searching"). No browser: tools/know_sources.py se_rows() on a sample of the real Posts.xml format."""
import io, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import know_sources as K
from harness import check, finish

xml = b'''<?xml version="1.0" encoding="utf-8"?><posts>
<row Id="1" PostTypeId="1" Score="12" AcceptedAnswerId="3" Title="Why does my car shake when braking?" Body="&lt;p&gt;My 2015 Corolla shakes at 80 km/h when I brake.&lt;/p&gt;" />
<row Id="2" PostTypeId="2" ParentId="1" Score="4" Body="&lt;p&gt;Could be tyres.&lt;/p&gt;" />
<row Id="3" PostTypeId="2" ParentId="1" Score="20" Body="&lt;p&gt;Warped front &lt;b&gt;brake discs&lt;/b&gt; are the usual cause. Measure the runout:&lt;/p&gt;&lt;pre&gt;&lt;code&gt;runout &amp;lt; 0.05 mm&lt;/code&gt;&lt;/pre&gt;&lt;ul&gt;&lt;li&gt;Replace or skim the discs&lt;/li&gt;&lt;/ul&gt;" />
<row Id="4" PostTypeId="1" Score="1" Title="Low score question" Body="x" />
<row Id="5" PostTypeId="2" ParentId="4" Score="9" Body="&lt;p&gt;An answer to a low question that is long enough to keep around for sure.&lt;/p&gt;" />
<row Id="6" PostTypeId="1" Score="8" Title="Closed one" ClosedDate="2020-01-01" Body="x" />
<row Id="7" PostTypeId="1" Score="5" Title="No answer with votes" Body="y" />
</posts>'''
rows = K.se_rows(io.BytesIO(xml), "mechanics.stackexchange.com")
check(len(rows) == 1, "only a voted question with a voted answer is kept (not low-voted, closed or unanswered): %d" % len(rows))
r = rows[0]
check(r["t"] == "Why does my car shake when braking?" and r["u"] == "https://mechanics.stackexchange.com/q/1", "title and a link to the question (the authors are named there — the CC BY-SA credit)")
check("Answer (20 votes, accepted)" in r["x"] and "runout < 0.05 mm" in r["x"] and "• Replace or skim" in r["x"], "the best answer as plain text, code and lists kept: " + r["x"][:90].replace("\n", " "))
check(set(K.SE_PACKS) == {"qa-tech", "qa-cars", "qa-home", "qa-science", "qa-life", "qa-language", "qa-code"} and all(k in K.BUILDERS for k in K.SE_PACKS), "seven Q&A packs can be built")
check(not any("islam" in s or "medical" in s or "law." in s for _, _, sites in K.SE_PACKS.values() for s in sites), "no religious, medical or legal Q&A sites (community answers are not a ruling, a diagnosis or legal advice)")
finish()
