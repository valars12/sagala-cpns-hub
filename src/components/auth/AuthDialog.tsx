import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
};

export const AuthDialog = ({ open, onOpenChange, defaultTab = "login" }: Props) => {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{tab === "login" ? "Masuk Akun" : "Daftar Akun Baru"}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v: string) => setTab(v as "login" | "register")} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">Masuk</TabsTrigger>
            <TabsTrigger value="register">Daftar</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-4">
            <LoginForm onSuccess={() => onOpenChange(false)} onSwitchToRegister={() => setTab("register")} />
          </TabsContent>
          <TabsContent value="register" className="pt-4">
            <RegisterForm onSuccess={() => onOpenChange(false)} onSwitchToLogin={() => setTab("login")} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
