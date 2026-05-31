// tweaks-app.jsx — Homina landing page tweak controls
// Applies refined palette / font / effect choices to the document.

const HOMINA_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "palette": ["#c02a2f", "#e8453f"],
    "displayFont": "spectral",
    "optic": true,
    "grain": false,
    "parallax": 14,
    "showTempCode": true,
    "tempCode": "HOMINAMAY",
    "tempNote": "Limited-time code — redeem in-game before it expires."
}/*EDITMODE-END*/;

function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function HominaTweaks() {
    const [t, setTweak] = useTweaks(HOMINA_TWEAK_DEFAULTS);

    React.useEffect(() => {
        const root = document.documentElement;
        const [accent, bright] = t.palette;
        root.style.setProperty("--accent", accent);
        root.style.setProperty("--red", accent);
        root.style.setProperty("--accent-bright", bright);
        root.style.setProperty("--red-bright", bright);
        root.style.setProperty("--accent-glow", hexToRgba(bright, 0.4));
    }, [t.palette]);

    React.useEffect(() => {
        const b = document.body;
        if (t.displayFont === "spectral") b.removeAttribute("data-font");
        else b.setAttribute("data-font", t.displayFont);
    }, [t.displayFont]);

    React.useEffect(() => {
        document.body.setAttribute("data-optic", t.optic ? "on" : "off");
    }, [t.optic]);

    React.useEffect(() => {
        document.body.classList.toggle("fx-grain", !!t.grain);
    }, [t.grain]);

    React.useEffect(() => {
        window.__parallaxStrength = t.parallax;
    }, [t.parallax]);

    React.useEffect(() => {
        document.body.classList.toggle("fx-tempcode", !!t.showTempCode);
    }, [t.showTempCode]);

    React.useEffect(() => {
        const el = document.getElementById("temp-code");
        if (el) el.textContent = t.tempCode;
    }, [t.tempCode]);

    React.useEffect(() => {
        const el = document.getElementById("temp-note");
        if (el) el.textContent = t.tempNote;
    }, [t.tempNote]);

    return (
        <TweaksPanel>
            <TweakSection label="Palette" />
            <TweakColor
                label="Accent"
                value={t.palette}
                options={[
                    ["#c02a2f", "#e8453f"],
                    ["#8c1c1c", "#c0302a"],
                    ["#b5462a", "#e06a3c"],
                    ["#a01d1c", "#cf3b2a"]
                ]}
                onChange={(v) => setTweak("palette", v)}
            />
            <TweakToggle
                label="Machine-green optic accents"
                value={t.optic}
                onChange={(v) => setTweak("optic", v)}
            />

            <TweakSection label="Type" />
            <TweakRadio
                label="Display font"
                value={t.displayFont}
                options={["spectral", "marcellus", "cormorant"]}
                onChange={(v) => setTweak("displayFont", v)}
            />

            <TweakSection label="Atmosphere" />
            <TweakToggle
                label="CRT scanline grain"
                value={t.grain}
                onChange={(v) => setTweak("grain", v)}
            />
            <TweakSlider
                label="Hero parallax"
                value={t.parallax}
                min={0}
                max={30}
                step={1}
                unit="px"
                onChange={(v) => setTweak("parallax", v)}
            />

            <TweakSection label="Temporary code banner" />
            <TweakToggle
                label="Show banner"
                value={t.showTempCode}
                onChange={(v) => setTweak("showTempCode", v)}
            />
            <TweakText
                label="Code"
                value={t.tempCode}
                onChange={(v) => setTweak("tempCode", v)}
            />
            <TweakText
                label="Note"
                value={t.tempNote}
                onChange={(v) => setTweak("tempNote", v)}
            />
        </TweaksPanel>
    );
}

ReactDOM.createRoot(document.getElementById("tweaks-root")).render(<HominaTweaks />);
