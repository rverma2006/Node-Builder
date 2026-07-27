import { useState, useEffect } from "react";
import {
  fetchValidationTypes, fetchValidationDefinitions, fetchDefinitionTypes,
  fetchUnits, fetchElementTypes, fetchSpecialties, fetchValidationTypeDetails,
} from "../api";

export default function useLookups() {
  const [validationTypes,       setValidationTypes]       = useState([]);
  const [validationDefinitions, setValidationDefinitions] = useState([]);
  const [definitionTypes,       setDefinitionTypes]       = useState([]);
  const [validationTypeDetails, setValidationTypeDetails] = useState([]);
  const [units,                 setUnits]                 = useState([]);
  const [elementTypes,          setElementTypes]          = useState([]);
  const [specialties,           setSpecialties]           = useState([]);
  const [loading,               setLoading]               = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetchValidationTypes(),
      fetchValidationDefinitions(),
      fetchDefinitionTypes(),
      fetchUnits(),
      fetchElementTypes(),
      fetchSpecialties(),
      fetchValidationTypeDetails(),
    ]).then(([types, definitions, defTypes, unitRows, elemTypes, specs, vtDetails]) => {
      if (types.status       === "fulfilled") setValidationTypes(types.value);
      if (definitions.status === "fulfilled") setValidationDefinitions(definitions.value);
      if (defTypes.status    === "fulfilled") setDefinitionTypes(defTypes.value);
      if (unitRows.status    === "fulfilled") setUnits(unitRows.value);
      if (elemTypes.status   === "fulfilled") setElementTypes(elemTypes.value);
      if (specs.status       === "fulfilled") setSpecialties(specs.value);
      if (vtDetails.status   === "fulfilled") setValidationTypeDetails(vtDetails.value);
      setLoading(false);
    });
  }, []);

  return { validationTypes, validationDefinitions, definitionTypes,
    validationTypeDetails, units, elementTypes, specialties, loading };
}