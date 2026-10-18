import "./style.css";

console.log("Skin-Chroma-Randomizer loaded");

const RANDOM_SKINS_SETTING = "settings-random-skins-enabled";
const RANDOM_CHROMAS_SETTING = "settings-random-chromas-enabled";
const DISABLED_SKINS_SETTING = "settings-random-disabled-skins";
const DISABLED_CHROMAS_SETTING = "settings-random-disabled-chromas";

function getDataStore() {
  return (
    window.DataStore || (typeof DataStore !== "undefined" ? DataStore : null)
  );
}

function isRandomSkinEnabled() {
  const dataStore = getDataStore();
  if (dataStore?.get) return dataStore.get(RANDOM_SKINS_SETTING) === "true";

  return localStorage.getItem(RANDOM_SKINS_SETTING) === "true";
}

function setRandomSkinEnabled(enabled) {
  const value = String(enabled);
  const dataStore = getDataStore();

  if (dataStore?.set) {
    dataStore.set(RANDOM_SKINS_SETTING, value);
    return;
  }

  localStorage.setItem(RANDOM_SKINS_SETTING, value);
}

function isRandomChromaEnabled() {
  const dataStore = getDataStore();
  if (dataStore?.get) return dataStore.get(RANDOM_CHROMAS_SETTING) === "true";

  return localStorage.getItem(RANDOM_CHROMAS_SETTING) === "true";
}

function setRandomChromaEnabled(enabled) {
  const value = String(enabled);
  const dataStore = getDataStore();

  if (dataStore?.set) {
    dataStore.set(RANDOM_CHROMAS_SETTING, value);
    return;
  }

  localStorage.setItem(RANDOM_CHROMAS_SETTING, value);
}

function migrateRandomSkinSetting() {
  const dataStore = getDataStore();
  if (!dataStore?.get || !dataStore?.set) return;

  [RANDOM_SKINS_SETTING, RANDOM_CHROMAS_SETTING].forEach((setting) => {
    if (dataStore.get(setting) == null) {
      const legacyValue = localStorage.getItem(setting);
      if (legacyValue !== null) dataStore.set(setting, legacyValue);
    }
  });
}

function loadDisabledPreferences() {
  const dataStore = getDataStore();
  [
    [DISABLED_SKINS_SETTING, disabledSkinIds],
    [DISABLED_CHROMAS_SETTING, disabledChromaIds],
  ].forEach(([setting, targetSet]) => {
    const storedValue = dataStore?.get
      ? dataStore.get(setting)
      : localStorage.getItem(setting);
    if (storedValue == null) return;

    try {
      const ids = Array.isArray(storedValue)
        ? storedValue
        : JSON.parse(storedValue);
      if (Array.isArray(ids)) ids.forEach((id) => targetSet.add(id));
    } catch {
    }
  });
}

function saveDisabledPreference(setting, values) {
  const value = JSON.stringify([...values]);
  const dataStore = getDataStore();

  if (dataStore?.set) {
    dataStore.set(setting, value);
    return;
  }

  localStorage.setItem(setting, value);
}

function isDefaultSkin(skin) {
  return skin?.isBase === true || skin?.isBaseSkin === true || Number(skin?.id) % 1000 === 0;
}

function isBaseChroma(chroma, skin) {
  return (
    chroma?.isBase === true ||
    chroma?.isBaseChroma === true ||
    Number(chroma?.id) === Number(skin?.id)
  );
}

function addPluginCategory() {
  const settings = document.querySelector(
    "settings-plugin-navigation-bar > .lol-settings-nav-scroller > div",
  );

  if (!settings) return false;

  if (settings.querySelector(".pengu-plugin-category")) return true;

  const pluginCategoryTitle = document.createElement("div");
  pluginCategoryTitle.className =
    "lol-settings-nav-title pengu-plugin-category";
  pluginCategoryTitle.textContent = "Plugins";
  pluginCategoryTitle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  const pluginCategory = document.createElement("lol-uikit-navigation-bar");
  pluginCategory.setAttribute("direction", "down");
  pluginCategory.setAttribute("type", "tabbed");
  pluginCategory.setAttribute("selectedindex", "-1");

  const randomizersTab = document.createElement("lol-uikit-navigation-item");
  randomizersTab.setAttribute("name", "pengu-randomizers");
  randomizersTab.setAttribute("class", "lol-settings-nav");
  randomizersTab.textContent = "Randomizers";

  const options = document.querySelector(".lol-settings-options");
  const content = document.querySelector(".lol-settings-content");
  if (!options || !content) return false;
  const randomizersPage = document.createElement("div");
  randomizersPage.className = "pengu-randomizers-page";
  randomizersPage.hidden = true;
  randomizersPage.innerHTML = `
    <div class="pengu-randomizers-title">Randomizers</div>
    <div class="pengu-randomizers-row">
      <lol-uikit-flat-checkbox for="pengu-random-skins">
        <input slot="input" type="checkbox" name="pengu-random-skins">
        <label slot="label" for="pengu-random-skins">Randomize Skins</label>
      </lol-uikit-flat-checkbox>
    </div>
    <div class="pengu-randomizers-row">
      <lol-uikit-flat-checkbox for="pengu-random-chromas">
        <input slot="input" type="checkbox" name="pengu-random-chromas">
        <label slot="label" for="pengu-random-chromas">Randomize Chromas</label>
      </lol-uikit-flat-checkbox>
    </div>
    <div class="pengu-owned-champions-title">Cosmetic Filter</div>
    <input class="pengu-champion-filter" type="text" name="filter_name" placeholder="Champion name..." id="randomizer_champ_filter">
    <div class="pengu-champion-browser">
      <ul id="owned-champion-list" class="pengu-owned-champion-list"></ul>
      <aside id="pengu-skin-menu" class="pengu-skin-menu" hidden></aside>
    </div>
  `;

  const championFilter = randomizersPage.querySelector("#randomizer_champ_filter");
  const championList = randomizersPage.querySelector("#owned-champion-list");
  const championBrowser = randomizersPage.querySelector(".pengu-champion-browser");
  const skinMenu = randomizersPage.querySelector("#pengu-skin-menu");
  const skinCache = new Map();
  const chromaCache = new Map();
  const summonerIdPromise = fetchResponse("/lol-summoner/v1/current-summoner")
    .then(responseJson)
    .then((summoner) => summoner?.summonerId ?? summoner?.id ?? null);

  function showSkinMenu(champion, item) {
    if (item.classList.contains("is-selected")) {
      item.classList.remove("is-selected");
      championBrowser.classList.remove("menu-open");
      skinMenu.hidden = true;
      return;
    }

    randomizersPage
      .querySelectorAll(".pengu-owned-champion.is-selected")
      .forEach((selectedItem) => selectedItem.classList.remove("is-selected"));
    item.classList.add("is-selected");
    championBrowser.classList.add("menu-open");
    skinMenu.hidden = false;
    skinMenu.innerHTML = `<h3>${champion.alias}</h3><p class="pengu-skin-menu-status">Loading owned skins...</p>`;

    const cachedSkins = skinCache.get(champion.id);
    const skinsPromise = cachedSkins ? Promise.resolve(cachedSkins) : summonerIdPromise
      .then((summonerId) => {
        if (!summonerId) return [];
        return fetchResponse(
          `/lol-champions/v1/inventories/${summonerId}/champions/${champion.id}/skins`,
        );
      })
      .then(responseJson)
      .then((skins) => {
        const ownedSkins = Array.isArray(skins)
          ? skins
          : Array.isArray(skins?.skins)
            ? skins.skins
            : [];
        const ownedOnlySkins = ownedSkins.filter(
          (skin) => skin.ownership?.owned === true || skin.owned === true,
        );
        skinCache.set(champion.id, ownedOnlySkins);
        return ownedOnlySkins;
      });

    skinsPromise.then((skins) => {
      const currentItem = randomizersPage.querySelector(
        ".pengu-owned-champion.is-selected",
      );
      if (currentItem !== item) return;

      skinMenu.innerHTML = `<h3>${champion.alias}</h3>`;
      if (skins.length === 0) {
        skinMenu.insertAdjacentHTML(
          "beforeend",
          '<p class="pengu-skin-menu-status">No owned skins found.</p>',
        );
        return;
      }

      skins.forEach((skin) => {
        if (isDefaultSkin(skin) && !initializedDefaultSkinIds.has(skin.id)) {
          initializedDefaultSkinIds.add(skin.id);
          disabledSkinIds.add(skin.id);
          saveDisabledPreference(DISABLED_SKINS_SETTING, disabledSkinIds);
        }

        const skinEntry = document.createElement("section");
        skinEntry.className = "pengu-skin-entry";
        if (disabledSkinIds.has(skin.id))
          skinEntry.classList.add("is-disabled");

        const skinName = document.createElement("div");
        skinName.className = "pengu-skin-entry-name";
        skinName.textContent = skin.name || "Unnamed skin";
        skinName.addEventListener("click", () => {
          if (disabledSkinIds.has(skin.id)) {
            disabledSkinIds.delete(skin.id);
            skinEntry.classList.remove("is-disabled");
          } else {
            disabledSkinIds.add(skin.id);
            skinEntry.classList.add("is-disabled");
          }
          saveDisabledPreference(DISABLED_SKINS_SETTING, disabledSkinIds);
        });
        skinEntry.append(skinName);

        const chromasPromise = chromaCache.has(skin.id)
          ? Promise.resolve(chromaCache.get(skin.id))
          : summonerIdPromise
              .then((summonerId) => {
                if (!summonerId) return [];
                return fetchResponse(
                  `/lol-champions/v1/inventories/${summonerId}/champions/${champion.id}/skins/${skin.id}/chromas`,
                );
              })
              .then(responseJson)
              .then((chromas) => {
                const ownedChromas = Array.isArray(chromas)
                  ? chromas
                  : Array.isArray(chromas?.chromas)
                    ? chromas.chromas
                    : [];
                const ownedOnlyChromas = ownedChromas.filter(
                  (chroma) =>
                    isBaseChroma(chroma, skin) ||
                    chroma.ownership?.owned === true ||
                    chroma.owned === true,
                );
                chromaCache.set(skin.id, ownedOnlyChromas);
                return ownedOnlyChromas;
              });

        chromasPromise.then((chromas) => {
          if (currentItem !== item) return;
          const existingEntry = skinMenu.querySelector(
            `[data-skin-id="${skin.id}"]`,
          );
          if (!existingEntry) return;
          const existingStatus = existingEntry.querySelector(
            ".pengu-skin-menu-status",
          );
          if (existingStatus) existingStatus.remove();

          if (chromas.length > 0) {
          const chromaList = document.createElement("ul");
          chromaList.className = "pengu-skin-chroma-list";
          chromas.forEach((chroma) => {
            const chromaItem = document.createElement("li");
            chromaItem.textContent = isBaseChroma(chroma, skin)
              ? "No Chroma"
              : chroma.name || `Chroma ${chroma.id}`;
            if (disabledChromaIds.has(chroma.id))
              chromaItem.classList.add("is-disabled");
            chromaItem.title = "Click to include or exclude this chroma";
            chromaItem.addEventListener("click", () => {
              if (disabledChromaIds.has(chroma.id)) {
                disabledChromaIds.delete(chroma.id);
                chromaItem.classList.remove("is-disabled");
              } else {
                disabledChromaIds.add(chroma.id);
                chromaItem.classList.add("is-disabled");
              }
              saveDisabledPreference(
                DISABLED_CHROMAS_SETTING,
                disabledChromaIds,
              );
            });
            chromaList.append(chromaItem);
          });
            existingEntry.append(chromaList);
          } else {
            const status = document.createElement("p");
            status.className = "pengu-skin-menu-status";
            existingEntry.append(status);
          }
        });

        skinEntry.dataset.skinId = skin.id;
        const chromaStatus = document.createElement("p");
        chromaStatus.className = "pengu-skin-menu-status";
        chromaStatus.textContent = "Loading chromas...";
        skinEntry.append(chromaStatus);
        skinMenu.append(skinEntry);
      });
    });
  }

  fetchResponse("/lol-champions/v1/owned-champions-minimal")
    .then(responseJson)
    .then((champions) => {
      if (!Array.isArray(champions)) return;
      const ownedChampions = champions
        .filter(
          (champion) =>
            champion.ownership?.owned && !champion.alias.includes("Jade_"),
        )
        .sort((first, second) => first.alias.localeCompare(second.alias));
      ownedChampions.forEach((champion) => {
        const item = document.createElement("li");
        item.className = "pengu-owned-champion";

        const icon = document.createElement("img");
        icon.src = champion.squarePortraitPath;
        icon.alt = "";
        icon.loading = "lazy";

        const name = document.createElement("span");
        name.textContent = champion.alias;

        item.append(icon, name);
        item.addEventListener("click", () => showSkinMenu(champion, item));
        championList.append(item);
      });
    });

  championFilter.addEventListener("input", () => {
    const filterText = championFilter.value.trim().toLocaleLowerCase();
    randomizersPage.querySelectorAll(".pengu-owned-champion").forEach((champion) => {
      const championName = champion.querySelector("span")?.textContent ?? "";
      champion.hidden =
        filterText.length > 0 &&
        !championName.toLocaleLowerCase().includes(filterText);
    });
  });

  const randomSkinInput = randomizersPage.querySelector(
    'input[name="pengu-random-skins"]',
  );
  const randomChromaInput = randomizersPage.querySelector(
    'input[name="pengu-random-chromas"]',
  );
  randomSkinInput.checked = isRandomSkinEnabled();
  randomChromaInput.checked = isRandomChromaEnabled();
  randomSkinInput.addEventListener("change", () => {
    setRandomSkinEnabled(randomSkinInput.checked);
  });
  randomChromaInput.addEventListener("change", () => {
    setRandomChromaEnabled(randomChromaInput.checked);
  });

  const showRandomizers = (event) => {
    event.preventDefault();
    event.stopPropagation();
    randomizersTab.setAttribute("selected", "true");
    settings.querySelectorAll("lol-uikit-navigation-bar").forEach((bar) => {
      bar.setAttribute("selectedindex", "-1");
    });
    pluginCategory.setAttribute("selectedindex", "0");
    options.hidden = true;
    randomizersPage.hidden = false;
  };
  randomizersTab.addEventListener("click", showRandomizers);

  settings.addEventListener("click", (event) => {
    const navigationItem = event.target.closest?.(
      "lol-uikit-navigation-item",
    );
    if (!navigationItem || randomizersTab.contains(navigationItem))
      return;

    randomizersTab.removeAttribute("selected");
    pluginCategory.setAttribute("selectedindex", "-1");
    options.hidden = false;
    randomizersPage.hidden = true;
  });

  pluginCategory.append(randomizersTab);
  content.append(randomizersPage);

  settings.append(pluginCategoryTitle, pluginCategory);
  console.log("Plugins settings category added");
  return true;
}

function fetchResponse(url, options) {
  return fetch(url, options)
    .then((response) => (response.ok ? response : null))
    .catch(() => null);
}

function responseJson(response) {
  return response ? response.json().catch(() => null) : Promise.resolve(null);
}

function waitForSelectedSkin(selectedSkinId, attempts = 10) {
  return fetchResponse("/lol-champ-select/v1/session/my-selection")
    .then(responseJson)
    .then((selection) => {
      if (selection?.selectedSkinId === selectedSkinId) return selectedSkinId;
      if (attempts <= 0) return null;

      return new Promise((resolve) => window.setTimeout(resolve, 100)).then(() =>
        waitForSelectedSkin(selectedSkinId, attempts - 1),
      );
    });
}

function getSkinsForChamp(includeDisabledSkins = false) {
  return fetchResponse("/lol-champ-select/v1/skin-carousel-skins")
    .then(responseJson)
    .then((skins) => {
      if (!Array.isArray(skins)) return [];

      return skins
        .map((skin) => {
          if (isDefaultSkin(skin) && !initializedDefaultSkinIds.has(skin.id)) {
            initializedDefaultSkinIds.add(skin.id);
            disabledSkinIds.add(skin.id);
            saveDisabledPreference(DISABLED_SKINS_SETTING, disabledSkinIds);
          }
          return skin;
        })
        .filter((skin) => includeDisabledSkins || skin.unlocked)
        .filter(
          (skin) => includeDisabledSkins || !disabledSkinIds.has(skin.id),
        )
        .map((s) => ({
          skinId: s.id,
          skinName: s.name,
          chromaIds: s.childSkins.map((c) => String(c.id)),
          chromas: s.childSkins
            .filter((c) => c.unlocked)
            .filter((c) => !disabledChromaIds.has(c.id)),
        }));
    });
}

function isChampSelectActive() {
  return fetchResponse("/lol-gameflow/v1/gameflow-phase")
    .then(responseJson)
    .then((phase) => phase === "ChampSelect");
}

function randomizePickedSkin() {
  return isChampSelectActive().then((active) => {
    if (!active) {
      lastRandomizationKey = null;
      lastSkinSelectionKey = null;
      return null;
    }

    return fetchResponse("/lol-champ-select/v1/session")
    .then(responseJson)
    .then((session) => {
      if (!session) {
        lastRandomizationKey = null;
        return null;
      }

      const localPlayerAction = session.actions?.flat()[0];
      if (!localPlayerAction || !localPlayerAction.completed) {
        lastRandomizationKey = null;
        lastSkinSelectionKey = null;
        return null;
      }

      const randomizationKey = [
        session.gameId ?? "unknown-game",
        localPlayerAction.championId,
      ].join(":");
      if (randomizationKey === lastRandomizationKey) return null;
      lastRandomizationKey = randomizationKey;

      const randomSkinEnabled = isRandomSkinEnabled();
      const randomChromaEnabled = isRandomChromaEnabled();
      return getSkinsForChamp(!randomSkinEnabled).then((skins) => {
        if (skins.length === 0) return null;

        let selectedSkinPromise;
        let selectedSkinId;
        if (randomSkinEnabled && randomizationKey !== lastSkinSelectionKey) {
          selectedSkinId =
            skins[Math.floor(Math.random() * skins.length)].skinId;
          selectedSkinPromise = fetchResponse(
            "/lol-champ-select/v1/session/my-selection",
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ selectedSkinId }),
            },
          ).then((response) => {
            if (!response) return null;
            return waitForSelectedSkin(selectedSkinId);
          });
        } else
          selectedSkinPromise = fetchResponse(
            "/lol-champ-select/v1/session/my-selection",
          )
            .then(responseJson)
            .then((selection) => selection?.selectedSkinId ?? null);

        return selectedSkinPromise
          .then((selectedSkinId) => {
            if (selectedSkinId == null) return;
            if (!randomChromaEnabled) {
              lastRandomizationKey = randomizationKey;
              return;
            }
            const selectedSkin = skins.find(
              (skin) =>
                String(skin.skinId) === String(selectedSkinId) ||
                skin.chromaIds.includes(String(selectedSkinId)),
            );
            if (!selectedSkin || selectedSkin.chromas.length === 0) return;

            const selectedChroma =
              selectedSkin.chromas[
                Math.floor(Math.random() * selectedSkin.chromas.length)
              ];
            return fetchResponse("/lol-champ-select/v1/session/my-selection", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ selectedSkinId: selectedChroma.id }),
            }).then((response) => {
              if (!response) return;

              lastSkinSelectionKey = randomizationKey;
              console.log(
                `Random chroma ${selectedChroma.id} selected for skin ${selectedSkinId}`,
              );
              lastRandomizationKey = randomizationKey;
            });
          })
          .then(() => {
            if (randomSkinEnabled)
              console.log(
                `Random skin selected for champion ${localPlayerAction.championId}`,
              );
          });
      });
    });
  });
}

let randomizationInProgress = false;
let lastRandomizationKey = null;
let lastSkinSelectionKey = null;
let nextChampSelectCheck = 0;
const disabledSkinIds = new Set();
const disabledChromaIds = new Set();
const initializedDefaultSkinIds = new Set();

function checkChampSelect() {
  if (
    Date.now() < nextChampSelectCheck ||
    (!isRandomSkinEnabled() && !isRandomChromaEnabled()) ||
    randomizationInProgress
  )
    return;

  randomizationInProgress = true;
  randomizePickedSkin()
    .catch(() => {})
    .finally(() => {
      randomizationInProgress = false;
      nextChampSelectCheck = Date.now() + 2000;
    });
}

function initializePlugin() {
  migrateRandomSkinSetting();
  loadDisabledPreferences();
  window.setInterval(checkChampSelect, 1000);

  if (addPluginCategory()) return;

  const observer = new MutationObserver(() => {
    if (addPluginCategory()) observer.disconnect();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initializePlugin, {
    once: true,
  });
else initializePlugin();
