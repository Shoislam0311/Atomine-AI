"use client";
import React from "react";

import { useHandleStreamResponse } from "../utilities/runtime-helpers";

function MainComponent() {
  const [theme, setTheme] = useState("dark");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModel, setActiveModel] = useState("o1");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([
    { id: 1, title: "New Chat", active: true, model: "o1" },
  ]);
  const [folders, setFolders] = useState([
    { id: 1, name: "My Chats", expanded: true },
  ]);
  const [imageGeneration, setImageGeneration] = useState({
    prompt: "",
    loading: false,
    result: null,
    error: null,
    model: "dall-e",
  });
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [textareaHeight, setTextareaHeight] = useState("56px");
  const [responseMode, setResponseMode] = useState("think");
  const [contextMemory, setContextMemory] = useState([]);
  const [streamingMessage, setStreamingMessage] = useState("");
  const textareaRef = React.useRef(null);

  const handleStreamResponse = useHandleStreamResponse({
    onChunk: setStreamingMessage,
    onFinish: (message) => {
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      setStreamingMessage("");
      setLoading(false);
    },
  });

  const inferModelFromInput = (message, context) => {
    if (message.toLowerCase().includes("image")) return "image-gen";
    if (message.length > 100) return "o1";
    return activeModel;
  };

  const getModelEndpoint = (model) => {
    switch (model) {
      case "o1":
        return "/integrations/chat-gpt/conversationgpt4";
      case "o1-mini":
        return "/integrations/google-gemini-1-5/";
      case "v1":
        return "/integrations/anthropic-claude-sonnet-3-5/";
      case "image-gen":
        return imageGeneration.model === "dall-e"
          ? "/integrations/dall-e-3/"
          : "/integrations/stable-diffusion-v-3/";
      default:
        return "/integrations/chat-gpt/conversationgpt4";
    }
  };

  const getModelName = (modelId) => {
    switch (modelId) {
      case "o1":
        return "Atomine O1";
      case "o1-mini":
        return "Atomine O1 Mini";
      case "v1":
        return "Atomine V1";
      case "image-gen":
        return "Atomine Vision O1";
      default:
        return "Atomine O1";
    }
  };

  const generateImage = async (prompt) => {
    setImageGeneration((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const endpoint = getModelEndpoint("image-gen");
      const response = await fetch(
        endpoint + "?prompt=" + encodeURIComponent(prompt)
      );
      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();

      setImageGeneration((prev) => ({
        ...prev,
        result: data.data[0],
        loading: false,
      }));

      const imageMessage = {
        role: "assistant",
        content: `![Generated Image](${data.data[0]})`,
        type: "image",
      };
      setMessages((prev) => [...prev, imageMessage]);
    } catch (error) {
      console.error("Image generation error:", error);
      setImageGeneration((prev) => ({
        ...prev,
        error: "Failed to generate image. Please try again.",
        loading: false,
      }));
    }
  };

  const handleMessage = async (message) => {
    const imageGenerationRegex =
      /^(generate|create|draw|make|design|imagine)( an? | )(image|picture|artwork|illustration|photo)/i;

    if (imageGenerationRegex.test(message)) {
      await generateImage(message);
      return message;
    }

    const hasImage = message.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (hasImage) {
      try {
        const imageAnalysis = await fetch("/integrations/gpt-vision/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this image and provide insights.",
                  },
                  { type: "image_url", image_url: { url: message } },
                ],
              },
            ],
          }),
        });
        const analysis = await imageAnalysis.json();
        return analysis.choices[0].message.content;
      } catch (err) {
        console.error("Image analysis error:", err);
      }
    }

    return message;
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "56px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + "px";
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversations((prev) => {
      const newConversations = prev.map((conv) => ({ ...conv, active: false }));
      return [
        ...newConversations,
        { id: Date.now(), title: "New Chat", active: true, model: activeModel },
      ];
    });
  };

  const switchConversation = (convId) => {
    setConversations((prev) =>
      prev.map((conv) => ({
        ...conv,
        active: conv.id === convId,
      }))
    );
    setMessages([]);
  };

  const deleteConversation = (convId) => {
    setConversations((prev) => {
      const filtered = prev.filter((conv) => conv.id !== convId);
      if (filtered.length === 0) {
        return [
          {
            id: Date.now(),
            title: "New Chat",
            active: true,
            model: activeModel,
          },
        ];
      }
      if (prev.find((conv) => conv.id === convId)?.active) {
        filtered[filtered.length - 1].active = true;
      }
      return filtered;
    });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    setLoading(true);
    setError(null);

    const processedMessage = await handleMessage(inputMessage);
    const inferredModel = inferModelFromInput(processedMessage, contextMemory);
    setActiveModel(inferredModel);

    const userMessage = {
      role: "user",
      content: processedMessage,
    };

    setContextMemory((prev) => [...prev, userMessage]);

    if (messages.length === 0) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.active ? { ...conv, title: inputMessage.slice(0, 30) } : conv
        )
      );
    }

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");

    try {
      const endpoint = getModelEndpoint(inferredModel);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          stream: true,
          parameters: {
            temperature: userPreferences.creativity,
            response_format: userPreferences.writingStyle,
            max_tokens:
              userPreferences.responseLength === "adaptive"
                ? "auto"
                : parseInt(userPreferences.responseLength),
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to get AI response");
      handleStreamResponse(response);
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to get a response. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className={`h-screen flex font-sans ${
        theme === "dark" ? "bg-[#0c0c0c] text-white" : "bg-white text-[#0c0c0c]"
      }`}
    >
      <div
        className={`${
          sidebarOpen ? "w-[320px] md:w-[320px]" : "w-0"
        } fixed md:relative h-full z-30 transition-all duration-300 flex flex-col bg-[#0c0c0c] border-r border-[#262626]`}
      >
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#262626] hover:bg-[#333] transition-colors text-sm"
          >
            <i className="fas fa-plus"></i>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {folders.map((folder) => (
            <div key={folder.id} className="mb-2">
              <div className="flex items-center px-3 py-2 text-sm text-[#888] hover:text-white transition-colors cursor-pointer">
                <i
                  className={`fas fa-chevron-${
                    folder.expanded ? "down" : "right"
                  } w-4`}
                ></i>
                <i className="fas fa-folder-open ml-2 mr-3"></i>
                {folder.name}
              </div>

              {folder.expanded &&
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group mx-2 mb-1 rounded-lg ${
                      conv.active ? "bg-[#262626]" : "hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <div
                      onClick={() => switchConversation(conv.id)}
                      className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                    >
                      <i
                        className={`fas ${
                          conv.model === "o1"
                            ? "fa-robot"
                            : conv.model === "o1-mini"
                            ? "fa-bolt"
                            : conv.model === "image-gen"
                            ? "fa-image"
                            : "fa-star"
                        } text-[#666]`}
                      ></i>
                      <span className="flex-1 truncate text-sm">
                        {conv.title}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-2">
                        <button
                          className="p-1.5 rounded hover:bg-[#404040] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <i className="fas fa-pen text-xs text-[#888]"></i>
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-[#404040] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                        >
                          <i className="fas fa-trash text-xs text-[#888]"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#262626] space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#262626] transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <i className="fas fa-user text-sm"></i>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">User Account</div>
              <div className="text-xs text-[#888]">Free Plan</div>
            </div>
            <i className="fas fa-ellipsis-v text-[#888]"></i>
          </div>

          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#262626] transition-colors text-sm">
            <i className="fas fa-moon text-[#888]"></i>
            <span>Dark Mode</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#262626] transition-colors text-sm">
            <i className="fas fa-cog text-[#888]"></i>
            <span>Settings</span>
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col h-full relative w-full">
        <div className="absolute top-0 left-0 right-0 h-14 md:h-16 bg-[#0c0c0c] border-b border-[#262626] flex items-center px-2 md:px-4 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[#262626] transition-colors"
          >
            <i className="fas fa-bars"></i>
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              {conversations.find((conv) => conv.active)?.title || "Atomine"}
            </h1>
          </div>

          <select
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            className="bg-[#262626] rounded-lg px-2 md:px-3 py-1.5 text-xs md:text-sm outline-none ml-2 md:ml-4"
          >
            <option value="o1">Atomine O1</option>
            <option value="o1-mini">Atomine O1 Mini</option>
            <option value="v1">Atomine V1</option>
            <option value="image-gen">Atomine Vision O1</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto pt-14 md:pt-16 pb-32 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4 md:p-8">
              <div className="text-center space-y-6 md:space-y-8 max-w-2xl mx-auto px-4">
                <h1 className="text-2xl md:text-4xl font-bold">
                  <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    Welcome to Atomine
                  </span>
                </h1>
                <p className="text-[#888] text-sm md:text-base">
                  Your AI assistant powered by multiple language models
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {[
                    {
                      icon: "🤖",
                      title: "Atomine O1",
                      desc: "Advanced reasoning & analysis",
                      model: "o1",
                    },
                    {
                      icon: "⚡",
                      title: "Atomine O1 Mini",
                      desc: "Fast & efficient responses",
                      model: "o1-mini",
                    },
                    {
                      icon: "🎨",
                      title: "Atomine Vision O1",
                      desc: "Create amazing images",
                      model: "image-gen",
                    },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveModel(feature.model)}
                      className="p-4 md:p-5 rounded-xl bg-[#262626] hover:bg-[#333] transition-all cursor-pointer group"
                    >
                      <div className="text-2xl md:text-3xl mb-3 transform group-hover:scale-110 transition-transform">
                        {feature.icon}
                      </div>
                      <h3 className="font-medium mb-2">{feature.title}</h3>
                      <p className="text-sm text-[#888]">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`py-3 md:py-4 ${
                    message.role === "assistant" ? "bg-[#0c0c0c]" : ""
                  } group`}
                >
                  <div className="flex items-start gap-3 md:gap-4 px-3 md:px-6">
                    <div
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-blue-500 to-purple-500"
                          : "bg-[#666]"
                      }`}
                    >
                      <i
                        className={`fas ${
                          message.role === "user" ? "fa-user" : "fa-robot"
                        } text-sm md:text-base`}
                      ></i>
                    </div>
                    <div className="flex-1 prose prose-invert max-w-none text-sm md:text-base">
                      {message.type === "image" ? (
                        <img
                          src={message.content.replace(
                            /!\[Generated Image\]\((.*)\)/,
                            "$1"
                          )}
                          alt="Generated"
                          className="rounded-lg max-w-full h-auto"
                        />
                      ) : (
                        message.content
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        className="p-1.5 hover:text-white hidden md:block"
                        title="Copy"
                        onClick={() =>
                          navigator.clipboard.writeText(message.content)
                        }
                      >
                        <i className="fas fa-copy text-sm"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {streamingMessage && (
                <div className="py-3 md:py-4">
                  <div className="flex items-start gap-3 md:gap-4 px-3 md:px-6">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#666] flex items-center justify-center shrink-0">
                      <i className="fas fa-robot text-sm md:text-base"></i>
                    </div>
                    <div className="flex-1 prose prose-invert max-w-none text-sm md:text-base">
                      {streamingMessage}
                      <span className="inline-block w-1.5 h-4 bg-white animate-pulse ml-1"></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-[#0c0c0c] border-t border-[#262626]">
          <div className="max-w-3xl mx-auto p-2 md:p-4">
            <div className="relative">
              <div className="flex items-end gap-2">
                <div className="flex-1 bg-[#262626] rounded-xl md:rounded-2xl">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      adjustTextareaHeight();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={`Message ${getModelName(activeModel)}...`}
                    className="w-full p-3 md:p-4 bg-transparent outline-none resize-none text-sm md:text-base min-h-[48px] md:min-h-[56px]"
                    style={{ height: textareaHeight }}
                    disabled={loading}
                  />
                  <div className="px-3 md:px-4 py-2 md:py-3 border-t border-[#404040] flex justify-between items-center">
                    <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                      {activeModel === "image-gen" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setImageGeneration((prev) => ({
                                ...prev,
                                model: "dall-e",
                              }))
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs ${
                              imageGeneration.model === "dall-e"
                                ? "bg-[#666]"
                                : "hover:bg-[#404040]"
                            }`}
                          >
                            DALL-E
                          </button>
                          <button
                            onClick={() =>
                              setImageGeneration((prev) => ({
                                ...prev,
                                model: "stable-diffusion",
                              }))
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs ${
                              imageGeneration.model === "stable-diffusion"
                                ? "bg-[#666]"
                                : "hover:bg-[#404040]"
                            }`}
                          >
                            Stable Diffusion
                          </button>
                        </div>
                      ) : (
                        <>
                          {[
                            { mode: "think", icon: "🧠", label: "Think" },
                            {
                              mode: "deepThink",
                              icon: "🔍",
                              label: "DeepThink",
                            },
                            {
                              mode: "deeperThink",
                              icon: "🧠⚙️",
                              label: "DeeperThink",
                            },
                          ].map((item) => (
                            <button
                              key={item.mode}
                              onClick={() => setResponseMode(item.mode)}
                              className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs md:text-sm whitespace-nowrap ${
                                responseMode === item.mode
                                  ? "bg-[#666] text-white"
                                  : "hover:bg-[#404040]"
                              } transition-colors flex items-center gap-1.5`}
                            >
                              <span>{item.icon}</span>
                              <span className="hidden sm:inline">
                                {item.label}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={loading || !inputMessage.trim()}
                      className={`p-2 rounded-lg transition-colors ${
                        inputMessage.trim()
                          ? "text-white hover:bg-[#404040]"
                          : "text-[#666]"
                      }`}
                    >
                      {loading ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-paper-plane"></i>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              {error && (
                <div className="absolute -top-6 left-0 right-0 text-center text-red-500 text-xs md:text-sm">
                  {error}
                </div>
              )}
            </div>
            <div className="mt-2 text-[10px] md:text-xs text-[#666] text-center">
              Atomine can make mistakes. Consider checking important
              information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;