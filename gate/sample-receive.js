(() => {
  const $ = (id) => document.getElementById(id);
  let current = null;

  function cid() {
    const v = $("companyId").value || localStorage.getItem("companyId") || "1";
    localStorage.setItem("companyId", v);
    return Number(v);
  }

  function currentUserName() {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return String(u.displayName || u.name || u.fullName || u.username || "").trim();
    } catch (_) {
      return "";
    }
  }

  function fmt(v) {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("ar-EG");
  }

  async function lookup() {
    const code = $("sampleCode").value.trim();
    if (!code) return alert("أدخل كود العينة.");

    const r = await apiGet("/gate/samples/warehouse/lookup", {
      companyId: cid(),
      code
    });

    current = r.data;
    $("codeOut").textContent = current.sampleCode || "-";
    $("descOut").textContent = current.sampleDescription || "-";
    $("countOut").textContent = current.packageCount || 1;
    $("gateTimeOut").textContent = fmt(current.gateRegisteredAt);
    $("poOut").textContent = current.purchaseOrderReference || "بدون أمر شراء";
    $("resultPanel").style.display = "";
  }

  $("lookupBtn").onclick = () => lookup().catch((e) => alert(e.message));
  $("sampleCode").onkeydown = (e) => {
    if (e.key === "Enter") lookup().catch((err) => alert(err.message));
  };

  $("receiveBtn").onclick = async () => {
    if (!current?.sampleUuid) {
      alert("ابحث عن كود العينة أولاً.");
      return;
    }

    const actorName = String($("receiverName").value || "").trim();
    if (!actorName) {
      alert("اكتب اسم مستلم العينة بالمخزن.");
      $("receiverName").focus();
      return;
    }

    const btn = $("receiveBtn");
    btn.disabled = true;
    $("receiveMessage").textContent = "جارٍ تسجيل الاستلام...";

    try {
      await apiPost(`/gate/samples/warehouse/${current.sampleUuid}/receive`, {
        companyId: cid(),
        actorName,
        notes: $("receiveNotes").value.trim()
      });

      $("receiveMessage").textContent = `تم استلام العينة ${current.sampleCode} بالمخزن بنجاح.`;
      alert(`تم استلام العينة ${current.sampleCode} بالمخزن.`);

      current = null;
      $("resultPanel").style.display = "none";
      $("sampleCode").value = "";
      $("receiveNotes").value = "";
      $("sampleCode").focus();
    } catch (e) {
      $("receiveMessage").textContent = `خطأ: ${e.message || e}`;
      alert(e.message || String(e));
    } finally {
      btn.disabled = false;
    }
  };

  $("companyId").value = localStorage.getItem("companyId") || "1";
  $("receiverName").value = currentUserName();

  apiGet("/gate/samples/warehouse/access", {})
    .catch((e) => {
      alert("ليس لديك صلاحية استلام العينات.");
      console.error(e);
    });
})();
