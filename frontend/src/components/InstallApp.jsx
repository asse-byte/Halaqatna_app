import { useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { useT } from "../lib/i18n";
import { useInstall } from "../lib/pwa";
import { btnGhost, btnPrimary, Modal } from "./ui-kit";

const toolBtn = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-muted";

/**
 * "Install the app". Shown only where it can do something: hidden inside the installed app
 * itself, a one-tap install where the browser offers one, and the Safari steps on iPhone and
 * iPad, where installing is only possible by hand. `compact` is the icon-only button of the
 * app's toolbar; the full-width one sits on the sign-in pages.
 */
export function InstallApp({ compact = false }) {
  const { t } = useT();
  const { standalone, canPrompt, ios, install } = useInstall();
  const [open, setOpen] = useState(false);
  if (standalone || (!canPrompt && !ios)) return null;

  const onClick = canPrompt ? install : () => setOpen(true);
  return (
    <>
      {compact ? (
        <button type="button" onClick={onClick} className={toolBtn} aria-label={t("install_app")} title={t("install_app")} data-testid="install-app-button">
          <Download size={15} strokeWidth={1.75} />
        </button>
      ) : (
        <button type="button" onClick={onClick} className={`${btnGhost} w-full !py-2.5`} data-testid="install-app-button">
          <Download size={16} strokeWidth={1.75} />{t("install_app")}
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("install_ios_title")}>
        <ol className="space-y-3 text-sm" data-testid="install-ios-steps">
          {[[Share, "install_ios_step1"], [SquarePlus, "install_ios_step2"], [Download, "install_ios_step3"]].map(([Icon, key], i) => (
            <li key={key} className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-muted/60 text-primary">
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <span className="pt-1.5 leading-relaxed"><b className="me-1 tabular-nums">{i + 1}.</b>{t(key)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("install_ios_note")}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" className={btnPrimary} onClick={() => setOpen(false)}>{t("close")}</button>
        </div>
      </Modal>
    </>
  );
}
