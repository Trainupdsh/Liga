import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/tabla', { replace: true });
  }, [navigate]);

  return null;
}
