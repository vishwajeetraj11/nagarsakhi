"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import { formatWardLabel, wardLocalityName } from "@/lib/domain/ward-label";
import { createFirebaseSupabaseClient } from "@/lib/supabase";
import { BrandLockup } from "./BrandLockup";

type LocationRow = {
  municipality_id: string;
  municipality_name: string;
  district: string;
  state: string;
  ward_id: string;
  ward_number: number;
  ward_name: string;
};

type LiveOnboardingProps = {
  user: User;
  onComplete: () => void;
  registrationRequired?: boolean;
};

export function LiveOnboarding({ user, onComplete, registrationRequired = false }: LiveOnboardingProps) {
  const supabase = useMemo(() => createFirebaseSupabaseClient(() => user.getIdToken(false)), [user]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [municipalityId, setMunicipalityId] = useState("");
  const [wardId, setWardId] = useState("");
  const [name, setName] = useState(user.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase) {
        setMessage("Supabase is not configured in this browser.");
        return;
      }

      const { data, error } = await supabase.rpc("list_onboarding_locations");
      if (cancelled) return;
      if (error || !data) {
        setMessage(error?.message ?? "Could not load municipality and ward options.");
        return;
      }

      const rows = data as LocationRow[];
      setLocations(rows);
      setMunicipalityId(rows[0]?.municipality_id ?? "");
      // Do not silently place a new account in the first ward. The resident
      // must make an explicit ward choice during setup.
      setWardId("");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const municipalities = useMemo(() => {
    const byId = new Map<string, LocationRow>();
    for (const location of locations) byId.set(location.municipality_id, location);
    return [...byId.values()];
  }, [locations]);

  const wards = locations.filter((location) => location.municipality_id === municipalityId);

  async function completeOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const selectedWard = wards.find((ward) => ward.ward_id === wardId);
    if (!supabase || !cleanName || !municipalityId || !selectedWard || selectedWard.municipality_id !== municipalityId) {
      setMessage(!cleanName ? "Enter your public or official display name." : "Choose a valid municipality and ward.");
      return;
    }

    setBusy(true);
    setMessage("");

    if (registrationRequired) {
      const { error } = await supabase.rpc("check_firebase_profile_registration", {
        target_municipality_id: municipalityId,
        target_ward_id: wardId,
      });
      setBusy(false);
      setMessage(error?.message ?? "Your registration was found. Please sign in again to open your ward.");
      return;
    }

    const { error } = await supabase.rpc("complete_firebase_profile_onboarding", {
      target_municipality_id: municipalityId,
      target_ward_id: wardId,
      display_name: cleanName,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    onComplete();
  }

  return (
    <main className="login-page live-onboarding" id="main-content">
      <section className="login-intro" aria-labelledby="ward-setup-title">
        <BrandLockup />
        <h1 id="ward-setup-title">Choose your municipality and ward.</h1>
        <p className="eyebrow">First-time setup</p>
      </section>

      <section className="login-panel" aria-labelledby="ward-form-title">
        <div>
          <p className="section-kicker">Ward setup</p>
          <h2 id="ward-form-title">Set your civic home</h2>
        </div>
        <form className="login-form onboarding-form" onSubmit={completeOnboarding}>
          <label htmlFor="onboarding-name">Public / official display name</label>
          <input
            autoComplete="name"
            id="onboarding-name"
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your public or official display name"
            required
            value={name}
          />

          <label htmlFor="onboarding-municipality">Municipality</label>
          <select
            id="onboarding-municipality"
            onChange={(event) => {
              const nextMunicipalityId = event.target.value;
              setMunicipalityId(nextMunicipalityId);
              setWardId("");
            }}
            required
            value={municipalityId}
          >
            {municipalities.map((municipality) => (
              <option key={municipality.municipality_id} value={municipality.municipality_id}>
                {municipality.municipality_name}, {municipality.district}, {municipality.state}
              </option>
            ))}
          </select>

          <label htmlFor="onboarding-ward">Ward</label>
          <select id="onboarding-ward" onChange={(event) => setWardId(event.target.value)} required value={wardId}>
            <option disabled value="">Choose your ward</option>
            {wards.map((ward) => (
              <option key={ward.ward_id} value={ward.ward_id}>
                {formatWardLabel(ward.ward_number)}{wardLocalityName(ward.ward_name) ? `: ${wardLocalityName(ward.ward_name)}` : ""}
              </option>
            ))}
          </select>

          <button className="primary-action" disabled={busy || !wardId} type="submit">
            {busy ? "Saving ward..." : "Open my ward"}
          </button>
        </form>
        {message ? <p aria-live="polite" className="form-message form-message--error" role="alert">{message}</p> : null}
      </section>
    </main>
  );
}
